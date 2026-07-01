export class NotificationProvider {
  constructor(name) {
    this.name = name;
  }

  async send() {
    throw new Error("send not implemented");
  }
}
