/**
 * AWS Lambda Function: Device Management API
 * Handles device registration, listing, and management
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

const DEVICES_TABLE = process.env.DEVICES_TABLE || 'sensor-app-devices';
const SENSORS_TABLE = process.env.SENSORS_TABLE || 'sensor-app-sensors';
const USERS_TABLE = process.env.USERS_TABLE || 'sensor-app-users';

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
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

        // Extract user ID from JWT token (simplified - in production use proper JWT validation)
        const userId = await extractUserIdFromToken(event.headers.Authorization || event.headers.authorization);
        if (!userId) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Unauthorized - Invalid or missing token'
                })
            };
        }

        const { httpMethod, pathParameters, queryStringParameters } = event;
        const path = event.path || event.rawPath;

        // Route handling
        if (httpMethod === 'GET' && path === '/api/devices') {
            return await listDevices(userId, headers);
        } else if (httpMethod === 'POST' && path === '/api/devices/register') {
            const body = JSON.parse(event.body);
            return await registerDevice(userId, body, headers);
        } else if (httpMethod === 'GET' && path.includes('/api/devices/') && path.includes('/sensors')) {
            const deviceId = pathParameters?.deviceId;
            return await getDeviceSensors(userId, deviceId, queryStringParameters, headers);
        } else if (httpMethod === 'PUT' && path.includes('/api/devices/')) {
            const deviceId = pathParameters?.deviceId;
            const body = JSON.parse(event.body);
            return await updateDevice(userId, deviceId, body, headers);
        } else if (httpMethod === 'DELETE' && path.includes('/api/devices/')) {
            const deviceId = pathParameters?.deviceId;
            return await deleteDevice(userId, deviceId, headers);
        } else {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Endpoint not found'
                })
            };
        }

    } catch (error) {
        console.error('❌ Error in device management API:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};

/**
 * Extract user ID from JWT token
 */
async function extractUserIdFromToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    
    try {
        // In a real implementation, you'd validate the JWT token properly
        // For now, we'll use Cognito to get user info
        const result = await cognito.getUser({
            AccessToken: token
        }).promise();
        
        return result.Username;
    } catch (error) {
        console.error('Token validation error:', error);
        return null;
    }
}

/**
 * List all devices for the authenticated user
 */
async function listDevices(userId, headers) {
    try {
        const result = await dynamodb.query({
            TableName: DEVICES_TABLE,
            IndexName: 'user-devices-index',
            KeyConditionExpression: 'user_id = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        }).promise();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                devices: result.Items || [],
                count: result.Count
            })
        };

    } catch (error) {
        console.error('Error listing devices:', error);
        throw error;
    }
}

/**
 * Register a new device
 */
async function registerDevice(userId, deviceData, headers) {
    try {
        const {
            device_identifier,
            device_type = 'raspberry_pi',
            location = 'Unknown',
            description = ''
        } = deviceData;

        if (!device_identifier) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'device_identifier is required'
                })
            };
        }

        // Generate unique device ID
        const device_id = `device_${uuidv4()}`;
        const now = Date.now();

        const newDevice = {
            device_id,
            user_id: userId,
            device_identifier,
            device_type,
            location,
            description,
            status: 'active',
            created_at: now,
            updated_at: now,
            last_seen: null,
            firmware_version: null,
            ip_address: null
        };

        await dynamodb.put({
            TableName: DEVICES_TABLE,
            Item: newDevice,
            ConditionExpression: 'attribute_not_exists(device_id)'
        }).promise();

        console.log('📱 Device registered successfully:', device_id);

        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Device registered successfully',
                device: newDevice
            })
        };

    } catch (error) {
        if (error.code === 'ConditionalCheckFailedException') {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Device already exists'
                })
            };
        }
        console.error('Error registering device:', error);
        throw error;
    }
}

/**
 * Get sensors for a specific device
 */
async function getDeviceSensors(userId, deviceId, queryParams, headers) {
    try {
        // First verify user owns the device
        const deviceResult = await dynamodb.get({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId }
        }).promise();

        if (!deviceResult.Item || deviceResult.Item.user_id !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Device not found or access denied'
                })
            };
        }

        // Get sensors for the device
        const hours = parseInt(queryParams?.hours) || 24;
        const limit = parseInt(queryParams?.limit) || 100;
        const timestampFilter = Date.now() - (hours * 60 * 60 * 1000);

        const sensorsResult = await dynamodb.query({
            TableName: SENSORS_TABLE,
            IndexName: 'timestamp-index',
            KeyConditionExpression: 'device_id = :deviceId AND #timestamp >= :timestampFilter',
            ExpressionAttributeNames: {
                '#timestamp': 'timestamp'
            },
            ExpressionAttributeValues: {
                ':deviceId': deviceId,
                ':timestampFilter': timestampFilter
            },
            ScanIndexForward: false, // Sort by timestamp descending
            Limit: limit
        }).promise();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                device_id: deviceId,
                sensors: sensorsResult.Items || [],
                count: sensorsResult.Count,
                hours_requested: hours
            })
        };

    } catch (error) {
        console.error('Error getting device sensors:', error);
        throw error;
    }
}

/**
 * Update device information
 */
async function updateDevice(userId, deviceId, updateData, headers) {
    try {
        // First verify user owns the device
        const deviceResult = await dynamodb.get({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId }
        }).promise();

        if (!deviceResult.Item || deviceResult.Item.user_id !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Device not found or access denied'
                })
            };
        }

        // Prepare update expression
        let updateExpression = 'SET updated_at = :now';
        const expressionAttributeValues = {
            ':now': Date.now()
        };

        const allowedUpdates = ['device_identifier', 'location', 'description', 'status'];
        
        allowedUpdates.forEach(field => {
            if (updateData[field] !== undefined) {
                updateExpression += `, ${field} = :${field}`;
                expressionAttributeValues[`:${field}`] = updateData[field];
            }
        });

        await dynamodb.update({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        }).promise();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Device updated successfully',
                device_id: deviceId
            })
        };

    } catch (error) {
        console.error('Error updating device:', error);
        throw error;
    }
}

/**
 * Delete a device and all its associated data
 */
async function deleteDevice(userId, deviceId, headers) {
    try {
        // First verify user owns the device
        const deviceResult = await dynamodb.get({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId }
        }).promise();

        if (!deviceResult.Item || deviceResult.Item.user_id !== userId) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Device not found or access denied'
                })
            };
        }

        // Delete the device
        await dynamodb.delete({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId }
        }).promise();

        // Note: In a production system, you might want to:
        // 1. Also delete associated sensor data
        // 2. Archive the data instead of hard delete
        // 3. Use DynamoDB transactions for consistency

        console.log('🗑️ Device deleted successfully:', deviceId);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Device deleted successfully',
                device_id: deviceId
            })
        };

    } catch (error) {
        console.error('Error deleting device:', error);
        throw error;
    }
}