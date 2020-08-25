const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

// modules
const iap = require("./handlers/iap");
const iotcore = require("./handlers/iotcore");

const app = express();
app.use(express.static(path.join(__dirname, "views")));
app.use(bodyParser.urlencoded({ extended: true }));

//app.get("/", iap.assert);
app.get("/", (req, res) => {
    let view = path.join(__dirname, "/views/home.html");
    res.sendFile(view);
});
app.post("/", iotcore.sendCommand);

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
});