const metadata = require("gcp-metadata");
const { OAuth2Client } = require("google-auth-library");

const oAuth2Client = new OAuth2Client();

// Cache externally fetched information for future invocations
let aud;
let path = require("path");

async function audience() {
    if (!aud && (await metadata.isAvailable())) {
        let project_number = await metadata.project("numeric-project-id");
        let project_id = await metadata.project("project-id");

        aud = "/projects/" + project_number + "/apps/" + project_id;
    }
    return aud;
}

async function validateAssertion(assertion) {
    if (!assertion) {
        return {};
    }

    // Check that the assertion's audience matches ours
    const aud = await audience();

    // Fetch the current certificates and verify the signature on the assertion
    const response = await oAuth2Client.getIapPublicKeys();
    const ticket = await oAuth2Client.verifySignedJwtWithCertsAsync(
        assertion,
        response.pubkeys,
        aud, ["https://cloud.google.com/iap"]
    );
    const payload = ticket.getPayload();

    // Return the two relevant pieces of information
    return {
        email: payload.email,
        sub: payload.sub,
    };
}

async function assert(req, res) {
    const assertion = req.header("X-Goog-IAP-JWT-Assertion");
    let email = "None";
    try {
        const info = await validateAssertion(assertion);
        email = info.email;
    } catch (error) {
        console.log(error);
    }
    let view = path.join(__dirname + "/../views/index.html");
    res.sendFile(view);
}

exports.assert = assert;