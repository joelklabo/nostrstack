export class MockLightningProvider {
  async createCharge(input: { amount: number; description: string }) {
    const id = `mock-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const invoice = `lnbc1mock${Math.random().toString(36).slice(2, 12)}`;
    return { id, invoice, amount: input.amount, description: input.description };
  }

  async getCharge() {
    return { status: 'paid', amount: 1 };
  }
}
