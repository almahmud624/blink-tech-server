const express = require("express");
const cors = require("cors");

const port = process.env.PORT || 4000;

const app = express();
app.use(cors());
app.use(express());

app.get("/", (req, res) => {
  res.send("Blink Tech Connected");
});

app.listen(port, () => {
  console.log("Blink Tech running on port", port);
});
