/**
 * Money Value Object — USD cents only.
 *
 * Golden Mandate: NEVER use floating-point for money.
 * All arithmetic operates on whole cents (integers).
 * Every instance is immutable — operations return new Money.
 */
export class Money {
  /** Internal store: whole cents (integer). */
  private readonly _cents: number;

  private constructor(cents: number) {
    if (!Number.isInteger(cents)) {
      throw new RangeError(
        `Money requires an integer cent value. Received: ${cents}`,
      );
    }
    this._cents = cents;
  }

  /** Create Money from a whole-cent integer (e.g. 1050 → $10.50). */
  static fromCents(cents: number): Money {
    return new Money(cents);
  }

  /** Zero dollars. */
  static zero(): Money {
    return new Money(0);
  }

  /** Raw cent value (integer). */
  get cents(): number {
    return this._cents;
  }

  /** Convenience flags for validations and UI decisions (still domain-safe). */
  get isZero(): boolean {
    return this._cents === 0;
  }

  get isPositive(): boolean {
    return this._cents > 0;
  }

  get isNegative(): boolean {
    return this._cents < 0;
  }

  // ─── Arithmetic (returns new Money) ────────────────────────

  add(other: Money): Money {
    return new Money(this._cents + other._cents);
  }

  subtract(other: Money): Money {
    return new Money(this._cents - other._cents);
  }

  // ─── Comparison ────────────────────────────────────────────

  equals(other: Money): boolean {
    return this._cents === other._cents;
  }

  greaterThan(other: Money): boolean {
    return this._cents > other._cents;
  }

  lessThan(other: Money): boolean {
    return this._cents < other._cents;
  }

  /**
   * Compare for sorting.
   * Returns negative if this < other, 0 if equal, positive if this > other.
   */
  compareTo(other: Money): number {
    return this._cents - other._cents;
  }

  /** JSON-friendly representation (cents integer). */
  toJSON(): number {
    return this._cents;
  }
}
