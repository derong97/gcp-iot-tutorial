// Disclaimer: this following piece of code is referenced from
// https://github.com/GoogleCloudPlatform/nodejs-docs-samples/blob/master/iot/manager/manager.js

const iot = require("@google-cloud/iot");
const dotenv = require("dotenv").config();

const cloudRegion = process.env.region;
const deviceId = process.env.deviceId;
const projectId = process.env.projectId;
const registryId = process.env.registryId;

// Send command to device.
async function sendCommand(req, res) {
    // [START iot_send_command]
    const iotClient = new iot.v1.DeviceManagerClient({
        // optional auth parameters.
    });

    const data = req.body.payload;
    const formattedName = iotClient.devicePath(
        projectId,
        cloudRegion,
        registryId,
        deviceId
    );

    const binaryData = Buffer.from(data).toString("base64");
    const request = {
        name: formattedName,
        binaryData: binaryData,
    };

    try {
        const responses = await iotClient.sendCommandToDevice(request);
        return res.send("Sent command");
    } catch (err) {
        return res.send("Could not send command");
    }
    // [END iot_send_command]
}

exports.sendCommand = sendCommand;