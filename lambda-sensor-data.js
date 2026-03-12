/**
 * AWS Lambda Function: Sensor Data Processing
 * Handles incoming sensor data from IoT devices
 */

const AWS = require('aws-sdk');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

const SENSORS_TABLE = process.env.SENSORS_TABLE || 'sensor-app-sensors';
const DEVICES_TABLE = process.env.DEVICES_TABLE || 'sensor-app-devices';
const ALERTS_TABLE = process.env.ALERTS_TABLE || 'sensor-app-alerts';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// Threshold configuration
const THRESHOLDS = {
    temperature: { min: 0, max: 40, unit: '°C' },
    humidity: { min: 20, max: 80, unit: '%' },
    light: { min: 0, max: 1000, unit: 'lux' },
    motion: { threshold: 1 }
};

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
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
        let sensorData;
        try {
            sensorData = JSON.parse(event.body);
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

        // Validate required fields
        const { device_id, readings } = sensorData;
        
        if (!device_id || !readings || !Array.isArray(readings)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Missing required fields: device_id and readings array'
                })
            };
        }

        console.log(`📊 Processing ${readings.length} sensor readings for device:`, device_id);

        // Verify device exists
        const deviceExists = await verifyDevice(device_id);
        if (!deviceExists.isValid) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: deviceExists.error
                })
            };
        }

        // Process each reading
        const processedReadings = [];
        const alerts = [];

        for (const reading of readings) {
            try {
                const processedReading = await processSensorReading(device_id, reading, deviceExists.device);
                processedReadings.push(processedReading);

                // Check for threshold violations
                const alert = checkThresholds(device_id, processedReading);
                if (alert) {
                    alerts.push(alert);
                }

            } catch (readingError) {
                console.error('Error processing reading:', readingError);
                // Continue processing other readings
            }
        }

        // Store all readings in batch
        if (processedReadings.length > 0) {
            await batchWriteReadings(processedReadings);
        }

        // Process alerts
        for (const alert of alerts) {
            try {
                await storeAlert(alert);
                await sendAlertNotification(alert);
            } catch (alertError) {
                console.error('Error processing alert:', alertError);
            }
        }

        // Update device last_seen timestamp
        await updateDeviceLastSeen(device_id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Sensor data processed successfully',
                data: {
                    device_id: device_id,
                    readings_processed: processedReadings.length,
                    alerts_generated: alerts.length,
                    timestamp: Date.now()
                }
            })
        };

    } catch (error) {
        console.error('❌ Error processing sensor data:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error processing sensor data',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};

/**
 * Verify device exists and is active
 */
async function verifyDevice(deviceId) {
    try {
        const result = await dynamodb.get({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId }
        }).promise();

        if (!result.Item) {
            return {
                isValid: false,
                error: `Device ${deviceId} not found`
            };
        }

        if (result.Item.status !== 'active') {
            return {
                isValid: false,
                error: `Device ${deviceId} is not active`
            };
        }

        return {
            isValid: true,
            device: result.Item
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
 * Process individual sensor reading
 */
async function processSensorReading(deviceId, reading, device) {
    const timestamp = reading.timestamp || Date.now();
    
    const processedReading = {
        device_id: deviceId,
        sensor_id: reading.sensor_id || 'default',
        sensor_type: reading.sensor_type || 'unknown',
        value: reading.value,
        unit: reading.unit || '',
        timestamp: timestamp,
        created_at: Date.now(),
        location: device.location || 'Unknown',
        metadata: {
            device_identifier: device.device_identifier,
            raw_data: reading.raw_data || null,
            calibration_applied: reading.calibration_applied || false
        }
    };

    // Validate sensor value
    if (typeof processedReading.value !== 'number' || isNaN(processedReading.value)) {
        throw new Error(`Invalid sensor value: ${processedReading.value}`);
    }

    return processedReading;
}

/**
 * Check sensor readings against thresholds
 */
function checkThresholds(deviceId, reading) {
    const { sensor_type, value, timestamp } = reading;
    const threshold = THRESHOLDS[sensor_type];

    if (!threshold) {
        return null; // No thresholds defined for this sensor type
    }

    let violation = null;

    if (threshold.min !== undefined && value < threshold.min) {
        violation = `below minimum (${value} < ${threshold.min})`;
    } else if (threshold.max !== undefined && value > threshold.max) {
        violation = `above maximum (${value} > ${threshold.max})`;
    } else if (threshold.threshold !== undefined && value >= threshold.threshold) {
        violation = `threshold exceeded (${value} >= ${threshold.threshold})`;
    }

    if (violation) {
        return {
            alert_id: `alert_${deviceId}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
            device_id: deviceId,
            alert_type: 'Threshold Violation',
            sensor_type: sensor_type,
            sensor_value: value,
            threshold_violation: violation,
            risk_label: 'Medium',
            description: [`${sensor_type.charAt(0).toUpperCase() + sensor_type.slice(1)} sensor ${violation}`],
            timestamp: timestamp,
            created_at: Date.now(),
            status: 'active',
            acknowledged: false
        };
    }

    return null;
}

/**
 * Batch write sensor readings to DynamoDB
 */
async function batchWriteReadings(readings) {
    // DynamoDB batch write limit is 25 items
    const batches = [];
    for (let i = 0; i < readings.length; i += 25) {
        batches.push(readings.slice(i, i + 25));
    }

    for (const batch of batches) {
        const writeRequests = batch.map(reading => ({
            PutRequest: {
                Item: reading
            }
        }));

        await dynamodb.batchWrite({
            RequestItems: {
                [SENSORS_TABLE]: writeRequests
            }
        }).promise();
    }

    console.log(`💾 Stored ${readings.length} sensor readings`);
}

/**
 * Store alert in DynamoDB
 */
async function storeAlert(alert) {
    await dynamodb.put({
        TableName: ALERTS_TABLE,
        Item: alert
    }).promise();

    console.log('🚨 Alert stored:', alert.alert_id);
}

/**
 * Send alert notification via SNS
 */
async function sendAlertNotification(alert) {
    if (!SNS_TOPIC_ARN) {
        return;
    }

    const message = {
        title: `⚠️ Sensor Alert`,
        body: `${alert.device_id}: ${alert.description[0]}`,
        data: {
            alertId: alert.alert_id,
            deviceId: alert.device_id,
            sensorType: alert.sensor_type,
            value: alert.sensor_value,
            timestamp: alert.timestamp
        }
    };

    await sns.publish({
        TopicArn: SNS_TOPIC_ARN,
        Message: JSON.stringify(message),
        Subject: message.title
    }).promise();

    console.log('📱 Alert notification sent');
}

/**
 * Update device last_seen timestamp
 */
async function updateDeviceLastSeen(deviceId) {
    try {
        await dynamodb.update({
            TableName: DEVICES_TABLE,
            Key: { device_id: deviceId },
            UpdateExpression: 'SET last_seen = :timestamp',
            ExpressionAttributeValues: {
                ':timestamp': Date.now()
            }
        }).promise();
    } catch (error) {
        console.error('Error updating device last_seen:', error);
        // Don't fail the request for this
    }
}