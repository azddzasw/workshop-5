import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value, NodeState  } from "../types";
import { delay } from "../utils";


export async function node(
  nodeId: number,
  N: number,
  F: number,
  initialValue: Value,
  isFaulty: boolean,
  nodesAreReady: () => boolean,
  setNodeIsReady: (index: number) => void
) {
  const node = express();
  node.use(express.json());
  node.use(bodyParser.json());

  let proposals: Map<number, Value[]> = new Map();
  let votes: Map<number, Value[]> = new Map();

  let currentState: NodeState = {
    killed: false,
    x: initialValue,
    decided: false,
    k: 0,
  };

  node.get("/status", (req, res) => {
    res.status(isFaulty ? 500 : 200).send(isFaulty ? "faulty" : "live");
  });

  node.get("/start", async (req, res) => {
    while (!nodesAreReady()) {
      await delay(100);
    }

    if (!isFaulty) {
      currentState.k = 1;
      currentState.x = initialValue;
      currentState.decided = false;

      for (let i = 0; i < N; i++) {
        await fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            k: currentState.k,
            x: currentState.x,
            type: "2P",
          }),
        }).catch((error) => console.error(`Error sending message: ${error}`));
      }
    } else {
      currentState.decided = null;
      currentState.x = null;
      currentState.k = null;
    }

    res.status(200).send("success");
  });

  node.post("/message", async (req, res) => {
    let { k, x, type } = req.body;

    if (!currentState.killed && !isFaulty) {
      if (type === "2P") {
        proposals.set(k, [...(proposals.get(k) || []), x]);

        if (proposals.get(k)!.length >= N - F) {
          const CN = proposals.get(k)!.filter((val) => val === 0).length;
          const CY = proposals.get(k)!.filter((val) => val === 1).length;
          x = CN > N / 2 ? 0 : CY > N / 2 ? 1 : "?";

          for (let i = 0; i < N; i++) {
            await fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ k, x, type: "2V" }),
            }).catch((error) => console.error(`Error sending message: ${error}`));
          }
        }
      } else if (type === "2V") {
        votes.set(k, [...(votes.get(k) || []), x]);

        if (votes.get(k)!.length >= N - F) {
          const CN = votes.get(k)!.filter((val) => val === 0).length;
          const CY = votes.get(k)!.filter((val) => val === 1).length;

          if (CN >= F + 1) {
            currentState.x = 0;
            currentState.decided = true;
          } else if (CY >= F + 1) {
            currentState.x = 1;
            currentState.decided = true;
          } else {
            currentState.x =
              CN > CY ? 0 : CN < CY ? 1 : Math.random() > 0.5 ? 0 : 1;
            currentState.k = k + 1;

            for (let i = 0; i < N; i++) {
              await fetch(`http://localhost:${BASE_NODE_PORT + i}/message`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ k: currentState.k, x: currentState.x, type: "2P" }),
              }).catch((error) => console.error(`Error sending message: ${error}`));
            }
          }
        }
      }
    }
    res.status(200).send("success");
  });

  node.get("/stop", async (req, res) => {
    currentState.killed = true;
    currentState.x = null;
    currentState.decided = null;
    currentState.k = 0;
    res.send("Node stopped");
  });

  node.get("/getState", (req, res) => {
    res.send(isFaulty ? {
      killed: currentState.killed,
      x: null,
      decided: null,
      k: null,
    } : currentState);
  });

  const server = node.listen(BASE_NODE_PORT + nodeId, () => {
    console.log(`Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`);
    setNodeIsReady(nodeId);
  });

  return server;
}





