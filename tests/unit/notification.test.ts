import { Nofications } from "../../src/service/notification";
import { SlackNotification } from "../../src/service/notification/slack";
import { Cache } from "../../src/service/cache";
import { createLogger } from "../helpers/logger";

const WEBHOOK = "/T000/B000/XXXX";

describe("SlackNotification", () => {
  it.each([
    ["postForkingErrorMessage", ":no_entry: Relayer detected forking!"],
    ["postErrorMessage", ":no_entry: Relayer unable to sync!"],
  ] as const)("%s posts a Slack block message to the webhook", async (method, title) => {
    const slack = new SlackNotification(WEBHOOK);
    const post = jest.spyOn(slack.axiosInstance, "post").mockResolvedValue({});
    await slack[method]("details here");
    expect(post).toHaveBeenCalledWith(WEBHOOK, {
      text: title,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: title } },
        { type: "section", block_id: "section567", text: { type: "mrkdwn", text: "details here" } },
      ],
    });
  });

  it("targets the Slack hooks base URL", () => {
    expect(new SlackNotification(WEBHOOK).axiosInstance.defaults.baseURL).toBe(
      "https://hooks.slack.com/services"
    );
  });

  it("swallows webhook failures", async () => {
    const slack = new SlackNotification(WEBHOOK);
    jest.spyOn(slack.axiosInstance, "post").mockRejectedValue(new Error("503"));
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(slack.postErrorMessage("x")).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("Nofications", () => {
  const setup = (devMode: boolean) => {
    const cache = new Cache(createLogger());
    const notifications = new Nofications({ slack: { incomingWebHook: WEBHOOK } }, cache, createLogger(), devMode);
    const slack = (notifications as unknown as { notificationChannels: SlackNotification[] }).notificationChannels[0];
    const forking = jest.spyOn(slack, "postForkingErrorMessage").mockResolvedValue();
    const error = jest.spyOn(slack, "postErrorMessage").mockResolvedValue();
    return { notifications, forking, error };
  };

  it("registers no channels when Slack is not configured", () => {
    const notifications = new Nofications({}, new Cache(createLogger()), createLogger(), false);
    expect((notifications as unknown as { notificationChannels: unknown[] }).notificationChannels).toEqual([]);
  });

  it("sends nothing in dev mode", async () => {
    const { notifications, forking, error } = setup(true);
    await notifications.postForkingErrorMessage("fork");
    await notifications.postErrorMessage("err");
    expect(forking).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("throttles repeated messages of the same kind", async () => {
    const { notifications, forking, error } = setup(false);
    await notifications.postForkingErrorMessage("fork 1");
    await notifications.postForkingErrorMessage("fork 2");
    await notifications.postErrorMessage("err 1");
    await notifications.postErrorMessage("err 2");
    expect(forking).toHaveBeenCalledTimes(1);
    expect(forking).toHaveBeenCalledWith("fork 1");
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("err 1");
  });
});
