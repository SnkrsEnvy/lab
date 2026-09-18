const fs = require("fs");
const path = require("path");
module.exports = (req, res) => {
  const b64 = fs.readFileSync(path.join(__dirname, "_assets", "gelato41-cover-v3.txt"), "utf8").trim();
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 5925) {
    res.status(500).json({error:"COVER_RECONSTRUCTION_SIZE_MISMATCH",bytes:buf.length});
    return;
  }
  res.setHeader("Content-Type","image/jpeg");
  res.setHeader("Content-Length",String(buf.length));
  res.setHeader("Cache-Control","public, max-age=31536000, immutable");
  res.setHeader("X-CannaCardz-Cover","CC-0163-s3v3");
  res.status(200).send(buf);
};
