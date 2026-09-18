module.exports = (req, res) => {
  const b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlNfGAAAAAASUVORK5CYII=";
  const buf = Buffer.from(b64, "base64");
  res.setHeader("Content-Type","image/png");
  res.setHeader("Content-Length", String(buf.length));
  res.setHeader("Cache-Control","public, max-age=0, must-revalidate");
  res.status(200).send(buf);
};
