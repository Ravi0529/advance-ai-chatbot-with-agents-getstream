import OpenAI from "openai";
import type { AssistantStream } from "openai/lib/AssistantStream";
import {
  type Channel,
  type Event,
  type MessageResponse,
  type StreamChat,
} from "stream-chat";

export class OpenAIResponseHandler {
  private message_text = "";
  private chunk_counter = 0;
  private run_id = "";
  private is_done = false;
  private last_update_time = 0;

  constructor(
    private readonly openai: OpenAI,
    private readonly openAiThread: OpenAI.Beta.Threads.Thread,
    private readonly assistantStream: AssistantStream,
    private readonly chatClient: StreamChat,
    private readonly channel: Channel,
    private readonly message: MessageResponse,
    private readonly onDispose: () => void
  ) {
    this.chatClient.on("ai_indicator.stop", this.handleStopGenerating);
  }

  run = async () => {};

  dispose = async () => {
    if (this.is_done) {
      return;
    }
    this.is_done = true;
    this.chatClient.off("ai_indication.stop", this.handleStopGenerating);
    this.onDispose();
  };

  private handleStopGenerating = async (event: Event) => {
    if (this.is_done || event.message_id !== this.message.id) {
      return;
    }
    console.log("Stop generating for message ", this.message.id);
    if (!this.openai || !this.openAiThread || !this.run_id) {
      return;
    }

    try {
      await this.openai.beta.threads.runs.cancel(
        this.openAiThread.id,
        this.run_id
      );
    } catch (error) {
      console.log("Error cancelling run", error);
    }
    await this.channel.sendEvent({
      type: "ai_indicator.clear",
      cid: this.message.cid,
      message_id: this.message.id,
    });
    await this.dispose();
  };

  private handleStreamEvent = async (event: Event) => {};

  private handleError = async (error: Error) => {
    if (this.is_done) {
      return;
    }
    await this.channel.sendEvent({
      type: "ai_indicator.update",
      ai_state: "AI_STATE_ERROR",
      cid: this.message.cid,
      message_id: this.message.id,
    });
    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: {
        text: error.message ?? "Error generating a message",
        message: error.toString(),
      },
    });
    await this.dispose();
  };

  private performWebSearch = async (query: string): Promise<string> => {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    if (!TAVILY_API_KEY) {
      return JSON.stringify({
        error: "Web search is not available, API key not configured.",
      });
    }

    console.log(`Performing a web search for ${query}`);

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query: query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Tavily search failed for query "${query}": `, errorText);

        return JSON.stringify({
          error: `Search failed with status: ${response.status}`,
          details: errorText,
        });
      }

      const data = await response.json();
      console.log(`Tavily search successfuk for query: ${query}`);

      return JSON.stringify(data);
    } catch (error) {
      console.error(`An exception occurred during web search for ${query}`);

      return JSON.stringify({
        error: "An Exception occurred during web search",
      });
    }
  };
}
