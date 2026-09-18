const fs = require("fs");
const path = require("path");
module.exports = (req, res) => {
  const dir = path.join(__dirname, "_assets", "gelato41-cover-final");
  const parts = Array.from({length: 12}, (_, i) =>
    fs.readFileSync(path.join(dir, `part-${String(i).padStart(2,"0")}.txt`), "utf8").trim()
  );
  const buf = Buffer.from(parts.join(""), "base64");
  if (buf.length !== 26883) {
    res.status(500).json({error:"COVER_RECONSTRUCTION_SIZE_MISMATCH",bytes:buf.length,expected:26883});
    return;
  }
  res.setHeader("Content-Type","image/jpeg");
  res.setHeader("Content-Length",String(buf.length));
  res.setHeader("Cache-Control","public, max-age=31536000, immutable");
  res.setHeader("X-CannaCardz-Cover","CC-0163-final");
  res.status(200).send(buf);
};
