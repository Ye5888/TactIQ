import * as ort from "onnxruntime-web";

let session: ort.InferenceSession | null = null;

export async function loadRLModel() {
    if (session) {
        return session;
    }

    session = await ort.InferenceSession.create(
        "/models/tactiq_v1.onnx"
    );

    console.log("TactIQ ONNX model loaded");
    console.log("Inputs:", session.inputNames);
    console.log("Outputs:", session.outputNames);

    return session;
}

export async function testRLModel() {
    const model = await loadRLModel();

    // Same shape we used during Python export: (1, 37)
    const observation = new Float32Array(37);

    const inputTensor = new ort.Tensor(
        "float32",
        observation,
        [1, 37]
    );

    const results = await model.run({
        observation: inputTensor,
    });

    const logits = results.action_logits;

    console.log("Output dimensions:", logits.dims);
    console.log("Number of logits:", logits.data.length);
}

export async function predictActions(
    observation: Float32Array,
    actionMask: boolean[]
): Promise<number[]> {
    const model = await loadRLModel();

    if (observation.length !== 37) {
        throw new Error(
            `Expected 37 observation values, got ${observation.length}`
        );
    }

    if (actionMask.length !== 75) {
        throw new Error(
            `Expected 75 mask values, got ${actionMask.length}`
        );
    }

    // Feed the real Phaser observation into ONNX.
    const inputTensor = new ort.Tensor(
        "float32",
        observation,
        [1, 37]
    );

    const results = await model.run({
        observation: inputTensor,
    });

    // Neural network gives us 75 logits.
    const logits = results.action_logits.data as Float32Array;

    const actions: number[] = [];

    // Each RL player owns 15 consecutive logits.
    for (let player = 0; player < 5; player++) {
        let bestAction = -1;
        let bestLogit = -Infinity;

        for (let action = 0; action < 15; action++) {
            const index = player * 15 + action;

            // Ignore illegal actions.
            if (!actionMask[index]) {
                continue;
            }

            if (logits[index] > bestLogit) {
                bestLogit = logits[index] as number;
                bestAction = action;
            }
        }

        actions.push(bestAction);
    }

    return actions;
}