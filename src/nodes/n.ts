import bodyParser from "body-parser";
import express from "express";
import { BASE_NODE_PORT } from "../config";
import { Value } from "../types";
import { startConsensus, stopConsensus } from "./consensus";

type NodeState = {
  killed: boolean;
  x: 0 | 1 | "?" | null;
  decided: boolean | null;
  k: number | null;
};

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

  let state: NodeState = {
    killed: false,
    x: initialValue,
    decided: null,
    k: null
  };

  node.get("/status", (req, res) => {
    if (isFaulty) {
      res.status(500).send("faulty");
    } else {
      res.status(200).send("live");
    }
  });

  node.get("/getState", (req, res) => {
    if (isFaulty) {
      state.x = null;
      state.decided = null;
      state.k = null;
    }
    res.json(state);
  });

  //start
  node.get("/start", async (req, res) => {
    if (!nodesAreReady()) {
      res.status(400).send("Not all nodes are ready yet");
      return;
    }
    await startConsensus(N); 
    res.send("Consensus algorithm started");
  });

  node.get("/stop", async (req, res) => {
    await stopConsensus(N); 
    state.killed = true;
    res.send("Consensus algorithm stopped");
  });

  node.post("/message", (req, res) => {
    // Implement message handling logic here
    // For now, let's just send a success message
    res.send("Message received");
  });

  // Start the server
  const server = node.listen(BASE_NODE_PORT + nodeId, async () => {
    console.log(
      `Node ${nodeId} is listening on port ${BASE_NODE_PORT + nodeId}`
    );

    setNodeIsReady(nodeId);
  });

  return server;
}

