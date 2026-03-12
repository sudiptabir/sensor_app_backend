/**
 * AWS Lambda Function: Receive ML Alert
 * Replacement for Firebase Cloud Function receiveMLAlert
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const ALERTS_TABLE = process.env.ALERTS_TABLE || 'sensor-app-alerts';
const DEVICES_TABLE = process.env.DEVICES_TABLE || 'sensor-app-devices';
const USERS_TABLE = process.env.USERS_TABLE || 'sensor-app-users';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
    };

    try {
        // Handle preflight OPTIONS request
        if (event.httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ message: 'CORS preflight successful' })
            };
        }

        // Only allow POST requests
        if (event.httpMethod !== 'POST') {
            return {
                statusCode: 405,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Method not allowed. Use POST'
                })
            };
        }

        // Parse request body
        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid JSON in request body'
                })
            };
        }

        const { deviceId, deviceIdentifier, mlAlert } = requestBody;

        // Validate required fields
        if (!deviceId || !deviceIdentifier || !mlAlert) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields: deviceId, deviceIdentifier, or mlAlert'
                })
            };
        }

        console.log('📥 ML Alert received:', {
            deviceId,
            deviceIdentifier,
            alertType: mlAlert.notification_type,
            riskLevel: mlAlert.risk_label,
            timestamp: new Date(mlAlert.timestamp || Date.now())
        });

        // Verify device exists
        const deviceMatch = await verifyDevice(deviceId, deviceIdentifier);
        if (!deviceMatch.isValid) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Device verification failed: ${deviceMatch.error}`
                })
            };
        }

        // Check if user is blocked
        const userBlocked = await checkUserBlocked(deviceMatch.userId);
        if (userBlocked) {
            console.log(`🚫 Alert blocked - User ${deviceMatch.userId} is blocked`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Alert received but not processed (user blocked)',
                    alertId: null
                })
            };
        }

        // Generate alert ID and prepare alert data
        const alertId = uuidv4();
        const timestamp = mlAlert.timestamp || Date.now();

        const alertData = {
            alert_id: alertId,
            device_id: deviceId,
            device_identifier: deviceIdentifier,
            user_id: deviceMatch.userId,
            alert_type: mlAlert.notification_type || 'Alert',
            detected_objects: mlAlert.detected_objects || [],
            risk_label: mlAlert.risk_label || 'Unknown',
            predicted_risk: mlAlert.predicted_risk || mlAlert.risk_label || 'Unknown',
            description: Array.isArray(mlAlert.description) 
                ? mlAlert.description 
                : [mlAlert.description || 'ML detection alert'],
            screenshots: mlAlert.screenshot || [],
            timestamp: timestamp,
            created_at: Date.now(),
            model_version: mlAlert.model_version || 'unknown',
            confidence_score: mlAlert.confidence_score || 0,
            status: 'active',
            acknowledged: false
        };

        // Store alert in DynamoDB
        await dynamodb.put({
            TableName: ALERTS_TABLE,
            Item: alertData
        }).promise();

        console.log('💾 Alert stored successfully:', alertId);

        // Send push notification
        if (SNS_TOPIC_ARN && mlAlert.risk_label === 'High') {
            try {
                await sendPushNotification(alertData);
                console.log('📱 Push notification sent successfully');
            } catch (notificationError) {
                console.error('❌ Push notification failed:', notificationError);
                // Don't fail the entire request for notification errors
            }
        }

        // Return success response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'ML alert processed successfully',
                data: {
                    alertId: alertId,
                    timestamp: timestamp,
                    deviceId: deviceId,
                    riskLevel: mlAlert.risk_label
                }
            })
        };

    } catch (error) {
        console.error('❌ Error processing ML alert:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error processing alert',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};

/**
 * Verify device exists and get user ID
 */
async function verifyDevice(deviceId, deviceIdentifier) {
    try {
        const result = await dynamodb.get({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId }
        }).promise();

        if (!result.Item) {
            return {
                isValid: false,
                error: `Device ${deviceId} not found in database`
            };
        }

        const device = result.Item;

        // Optionally verify device identifier matches
        if (device.device_identifier && device.device_identifier !== deviceIdentifier) {
            return {
                isValid: false,
                error: `Device identifier mismatch for ${deviceId}`
            };
        }

        return {
            isValid: true,
            userId: device.user_id,
            device: device
        };

    } catch (error) {
        console.error('Error verifying device:', error);
        return {
            isValid: false,
            error: 'Database error during device verification'
        };
    }
}

/**
 * Check if user is blocked from receiving alerts
 */
async function checkUserBlocked(userId) {
    try {
        const result = await dynamodb.get({
            TableName: USERS_TABLE,
            Key: { user_id: userId }
        }).promise();

        if (!result.Item) {
            console.warn(`User ${userId} not found, allowing alert`);
            return false;
        }

        return result.Item.blocked === true || result.Item.alerts_blocked === true;

    } catch (error) {
        console.error('Error checking user blocked status:', error);
        // If there's an error, default to allowing the alert
        return false;
    }
}

/**
 * Send push notification via SNS
 */
async function sendPushNotification(alertData) {
    const message = {
        title: `🚨 ${alertData.risk_label} Risk Alert`,
        body: `${alertData.device_identifier}: ${alertData.description[0] || 'Detection alert'}`,
        data: {
            alertId: alertData.alert_id,
            deviceId: alertData.device_id,
            riskLevel: alertData.risk_label,
            timestamp: alertData.timestamp
        }
    };

    // For mobile push notifications, you might need different message formats
    // for iOS (APNS) and Android (FCM)
    const snsMessage = {
        default: JSON.stringify(message),
        APNS: JSON.stringify({
            aps: {
                alert: {
                    title: message.title,
                    body: message.body
                },
                sound: 'default',
                badge: 1
            },
            data: message.data
        }),
        GCM: JSON.stringify({
            data: {
                title: message.title,
                body: message.body,
                ...message.data
            }
        })
    };

    await sns.publish({
        TopicArn: SNS_TOPIC_ARN,
        Message: JSON.stringify(snsMessage),
        MessageStructure: 'json',
        Subject: message.title
    }).promise();
}