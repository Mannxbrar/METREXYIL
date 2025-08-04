const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt, negative_prompt, width, height } = JSON.parse(event.body);
        const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

        if (!REPLICATE_API_KEY) {
            throw new Error('API key is not set up in Netlify.');
        }

        const API_HOST = "https://api.replicate.com";
        const MODEL_VERSION = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

        const startResponse = await fetch(`${API_HOST}/v1/predictions`, {
            method: "POST",
            headers: { "Authorization": `Token ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                version: MODEL_VERSION,
                input: { prompt, negative_prompt, width, height, num_outputs: 4 },
            }),
        });

        let prediction = await startResponse.json();
        if (startResponse.status !== 201) {
            return { statusCode: 500, body: JSON.stringify({ detail: prediction.detail || "Failed to start prediction." }) };
        }

        while (prediction.status !== "succeeded" && prediction.status !== "failed") {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const pollResponse = await fetch(`${API_HOST}/v1/predictions/${prediction.id}`, {
                headers: { "Authorization": `Token ${REPLICATE_API_KEY}`, "Content-Type": "application/json" },
            });
            prediction = await pollResponse.json();
            if (pollResponse.status !== 200) {
                 return { statusCode: 500, body: JSON.stringify({ detail: prediction.detail || "Polling failed." }) };
            }
        }

        if (prediction.status === "failed") {
             return { statusCode: 500, body: JSON.stringify({ detail: `Prediction failed: ${prediction.error}` }) };
        }

        return { statusCode: 200, body: JSON.stringify(prediction.output) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ detail: error.message }) };
    }
};
