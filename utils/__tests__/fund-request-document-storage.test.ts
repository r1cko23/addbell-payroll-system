import { describe, expect, it } from "vitest";
import { isPostgresUniqueViolation } from "@/lib/fund-request-document-storage";

describe("isPostgresUniqueViolation", () => {
  it("matches Postgres unique_violation code 23505", () => {
    expect(
      isPostgresUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "idx_fund_request_documents_storage_path"',
      })
    ).toBe(true);
  });

  it("matches duplicate-key messages when the code is missing", () => {
    expect(
      isPostgresUniqueViolation({
        message: "duplicate key value violates unique constraint \"fund_request_documents_pkey\"",
      })
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(
      isPostgresUniqueViolation({
        code: "23503",
        message: "insert or update on table violates foreign key constraint",
      })
    ).toBe(false);
  });
});
