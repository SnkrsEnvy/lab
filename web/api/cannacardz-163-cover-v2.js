const fs = require("fs");
const path = require("path");
module.exports = (req, res) => {
  const dir = path.join(__dirname, "_assets", "gelato41-cover-q1");
  const parts = [
    "part-0.txt","part-1.txt","part-2.txt",
    "part-3.txt","part-4.txt","part-5.txt"
  ].map(name => fs.readFileSync(path.join(dir, name), "utf8").trim());
  const buf = Buffer.from(parts.join(""), "base64");
  if (buf.length !== 26883) {
    res.status(500).json({error:"COVER_RECONSTRUCTION_SIZE_MISMATCH",bytes:buf.length});
    return;
  }
  res.setHeader("Content-Type","image/jpeg");
  res.setHeader("Content-Length",String(buf.length));
  res.setHeader("Cache-Control","public, max-age=31536000, immutable");
  res.setHeader("X-CannaCardz-Cover","CC-0163-s3v2");
  res.status(200).send(buf);
};
