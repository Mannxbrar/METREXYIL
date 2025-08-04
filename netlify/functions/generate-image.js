const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { "Allow": "POST" },
      body: JSON.stringify({ error: "Method Not Allowed. Use POST." }),
    };
  }

  try {
    const { prompt, negative_prompt, width, height } = JSON.parse(event.body);
    const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY;

    if (!REPLICATE_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "REPLICATE_API_KEY not set in environment." }),
      };
    }

    const API_HOST = "https://api.replicate.com";
    const MODEL_VERSION = "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b";

    // Start the prediction
    const startResponse = await fetch(`${API_HOST}/v1/predictions`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: { prompt, negative_prompt, width, height, num_outputs: 4 },
      }),
    });

    if (startResponse.status !== 201) {
      const errorData = await startResponse.json();
      return {
        statusCode: 500,
        body: JSON.stringify({ error: errorData.detail || "Failed to start prediction." }),
      };
    }

    let prediction = await startResponse.json();

    // Poll until prediction finishes or fails
    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const pollResponse = await fetch(`${API_HOST}/v1/predictions/${prediction.id}`, {
        headers: {
          "Authorization": `Token ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (pollResponse.status !== 200) {
        const errorData = await pollResponse.json();
        return {
          statusCode: 500,
          body: JSON.stringify({ error: errorData.detail || "Polling failed." }),
        };
      }

      prediction = await pollResponse.json();
    }

    if (prediction.status === "failed") {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Prediction failed: ${prediction.error}` }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ output: prediction.output }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Unknown error" }),
    };
  }
};