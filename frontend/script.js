import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

socket.on("connect", () => {
  console.log("Connected to CampusGG WebSocket:", socket.id);

  socket.emit("message", "Hello from CampusGG frontend!");
});

socket.on("message", (message) => {
  console.log("Message from server:", message);
});

socket.on("disconnect", () => {
  console.log("Disconnected from CampusGG WebSocket");
});