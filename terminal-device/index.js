// Disclaimer: this following piece of code is referenced from
// https://github.com/GoogleCloudPlatform/nodejs-docs-samples/tree/master/iot/mqtt_example

// [START iot_mqtt_include]
const fs = require("fs");
const jwt = require("jsonwebtoken");
const mqtt = require("mqtt");
// [END iot_mqtt_include]

const dotenv = require("dotenv").config();

const projectId = process.env.projectId;
const deviceId = process.env.deviceId;
const registryId = process.env.registryId;
const region = process.env.region;
const algorithm = process.env.algorithm;
const privateKeyFile = process.env.privateKeyFile;
const mqttBridgeHostname = process.env.mqttBridgeHostname;
const mqttBridgePort = process.env.mqttBridgePort;
const messageType = process.env.messageType;
const tokenExpMins = process.env.tokenExpMins;

const MINIMUM_BACKOFF_TIME = 1;
const MAXIMUM_BACKOFF_TIME = 32;
let shouldBackoff = false;
let backoffTime = 1;

// Create a Cloud IoT Core JWT for the given project id, signed with the given private key.
// [START iot_mqtt_jwt]
const createJwt = (projectId, privateKeyFile, algorithm) => {
    // Create a JWT to authenticate this device. The device will be disconnected after the token expires, and
    // will have to reconnect with a new token. The audience field should always be set to the GCP project id.
    const token = {
        iat: parseInt(Date.now() / 1000),
        exp: parseInt(Date.now() / 1000) + 20 * 60, // 20 minutes
        aud: projectId,
    };
    const privateKey = fs.readFileSync(privateKeyFile);
    return jwt.sign(token, privateKey, { algorithm: algorithm });
};
// [END iot_mqtt_jwt]

const mqttClientId = `projects/${projectId}/locations/${region}/registries/${registryId}/devices/${deviceId}`;

// With Google Cloud IoT Core, the username field is ignored, however it must be non-empty.
// The password field is used to transmit a JWT to authorize the device.
// The "mqtts" protocol causes the library to connect using SSL, which is required for Cloud IoT Core.
const connectionArgs = {
    host: mqttBridgeHostname,
    port: mqttBridgePort,
    clientId: mqttClientId,
    username: "unused",
    password: createJwt(projectId, privateKeyFile, algorithm),
    protocol: "mqtts",
    secureProtocol: "TLSv1_2_method",
};

// Create a client, and connect to the Google MQTT bridge.
let client = mqtt.connect(connectionArgs);
let iatTime = parseInt(Date.now() / 1000);

// The MQTT topic that this device will publish data to.
// The topic name must end in 'state' to publish state and 'events' to publish telemetry.
// Note that this is not the same as the device registry's Cloud Pub/Sub topic.
const mqttTopic = `/devices/${deviceId}/${messageType}`;

const listeners = (client) => {
    client.on("connect", (success) => {
        console.log("connect");
        if (!success) {
            console.log("Client not connected...");
        }
    });

    client.on("close", () => {
        console.log("close");
        shouldBackoff = true;
    });

    client.on("error", (err) => {
        console.log("error", err);
    });

    client.on("message", (topic, message) => {
        let messageStr = "Message received: ";
        let data = null;
        if (topic === `/devices/${deviceId}/config`) {
            messageStr = "Config message received: ";
        } else if (topic.startsWith(`/devices/${deviceId}/commands`)) {
            messageStr = "Command message received: ";
        }
        if (data !== null) {
            messageStr += Buffer.from(message, "base64").toString("ascii");
            console.log(messageStr);
        }
    });

    client.on("packetsend", () => {
        // Note: logging packet send is very verbose
    });

    client.subscribe(`/devices/${deviceId}/config`, { qos: 1 });
    client.subscribe(`/devices/${deviceId}/commands/#`, { qos: 0 });
};

listeners(client);

const iot_mqtt_jwt_refresh = () => {
    const secsFromIssue = parseInt(Date.now() / 1000) - iatTime;
    if (secsFromIssue > tokenExpMins * 60) {
        iatTime = parseInt(Date.now() / 1000);
        console.log(`\tRefreshing token after ${secsFromIssue} seconds.`);

        client.end();
        connectionArgs.password = createJwt(projectId, privateKeyFile, algorithm);
        connectionArgs.protocolId = "MQTT";
        connectionArgs.protocolVersion = 4;
        connectionArgs.clean = true;
        client = mqtt.connect(connectionArgs);
        listeners(client);
    }
};

// [START iot_mqtt_publish]
const publishAsync = (mqttTopic, message) => {
    if (backoffTime >= MAXIMUM_BACKOFF_TIME) {
        console.log("Backoff time is too high. Giving up.");
        console.log("Closing connection to MQTT. Goodbye!");
        client.end();
        return;
    }

    let publishDelayMs = 0;
    if (shouldBackoff) {
        publishDelayMs = 1000 * (backoffTime + Math.random());
        backoffTime *= 2;
        console.log(`Backing off for ${publishDelayMs}ms before publishing.`);
    }

    setTimeout(() => {
        // Publish "payload" to the MQTT topic. qos=1 means at least once delivery.
        // Cloud IoT Core also supports qos=0 for at most once delivery.
        console.log("Publishing message:", message);
        client.publish(mqttTopic, message, { qos: 1 }, (err) => {
            if (!err) {
                shouldBackoff = false;
                backoffTime = MINIMUM_BACKOFF_TIME;
            }
        });
    }, publishDelayMs);
};
// [END iot_mqtt_publish]

// Using data trigger on terminal to simulate data transfer to the cloud
process.stdin.on("data", (data) => {
    if (client.connected) {
        iot_mqtt_jwt_refresh();
        publishAsync(mqttTopic, data.toString("utf8"));
    } else {
        console.log("Client not connected");
    }
});

console.log(
    "To simulate data collection, enter the data directly into the terminal :)"
);