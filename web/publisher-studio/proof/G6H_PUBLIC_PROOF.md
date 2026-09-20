# G6H Public G5I Proof Fixture

Fixture: `publisher-studio-demo-g5i.pdf`

SHA-256: `da37ed6b61739777d399c7292dbe5f88661f34ade3abae245aaf287d826e3c92`

Authority: frozen sample payload from authentic `Publisher_Studio_G5I_v015.zip`.

G6H proof question:

> Can the deployed Publisher Studio preview use the same-origin stateless G5I cell to inspect this exact PDF, stage a bounded true redaction, undo it, restage it, export a verified changed PDF, and preserve the untouched control page?

Claim ceiling:
- true redaction: in gate
- staged browser Undo: in gate
- verified PDF export: in gate
- OCR transport: out of gate
- forms transport: out of gate
- links transport: out of gate
- durable server workspace: out of gate
- production promotion: out of gate
