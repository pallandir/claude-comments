import { describe, expect, it } from "vitest";
import { isLocalUrl } from "./transport.js";

describe("isLocalUrl", () => {
  it("accepts http://localhost with a port", () => {
    expect(isLocalUrl("http://localhost:3000/")).toBe(true);
  });

  it("accepts http://127.0.0.1", () => {
    expect(isLocalUrl("http://127.0.0.1:8080/path")).toBe(true);
  });

  it("accepts *.localhost subdomains", () => {
    expect(isLocalUrl("http://myapp.localhost/")).toBe(true);
  });

  it("accepts nested *.localhost subdomains", () => {
    expect(isLocalUrl("http://a.b.localhost/")).toBe(true);
  });

  it("accepts IPv6 loopback [::1]", () => {
    expect(isLocalUrl("http://[::1]/")).toBe(true);
  });

  it("rejects a public hostname", () => {
    expect(isLocalUrl("https://example.com/")).toBe(false);
  });

  it("rejects a hostname that ends with 'localhost' but is not a subdomain", () => {
    expect(isLocalUrl("https://notlocalhost/")).toBe(false);
  });

  it("rejects an empty string (invalid URL)", () => {
    expect(isLocalUrl("")).toBe(false);
  });

  it("rejects a plain string that is not a URL", () => {
    expect(isLocalUrl("not a url")).toBe(false);
  });

  it("rejects a file:// URL", () => {
    expect(isLocalUrl("file:///etc/passwd")).toBe(false);
  });
});
