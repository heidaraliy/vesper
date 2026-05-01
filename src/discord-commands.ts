import {
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";

export function commandPayloads(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return [
    new SlashCommandBuilder()
      .setName("project")
      .setDescription("Inspect Vesper projects.")
      .addSubcommand((sub) => sub.setName("list").setDescription("List configured projects."))
      .addSubcommand((sub) => sub
        .setName("inspect")
        .setDescription("Inspect a project.")
        .addStringOption((option) => option.setName("project").setDescription("Project slug").setRequired(true)))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("todo")
      .setDescription("Manage Vesper todos.")
      .addSubcommand((sub) => sub
        .setName("add")
        .setDescription("Add a todo.")
        .addStringOption((option) => option.setName("project").setDescription("Project slug").setRequired(true))
        .addStringOption((option) => option.setName("title").setDescription("Todo title").setRequired(true))
        .addStringOption((option) => option.setName("body").setDescription("Details").setRequired(false))
        .addStringOption((option) => option
          .setName("mode")
          .setDescription("Autonomy mode")
          .addChoices({ name: "plan-gated", value: "plan-gated" }, { name: "automatic", value: "automatic" })
          .setRequired(false)))
      .addSubcommand((sub) => sub
        .setName("list")
        .setDescription("List open todos.")
        .addStringOption((option) => option.setName("project").setDescription("Project slug").setRequired(false)))
      .addSubcommand((sub) => sub
        .setName("pick")
        .setDescription("Start an agent on a todo.")
        .addStringOption((option) => option.setName("todo").setDescription("Todo ID").setRequired(true))
        .addStringOption((option) => option
          .setName("mode")
          .setDescription("Override autonomy mode")
          .addChoices({ name: "plan-gated", value: "plan-gated" }, { name: "automatic", value: "automatic" })
          .setRequired(false)))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("agent")
      .setDescription("Control Vesper agents.")
      .addSubcommand((sub) => sub
        .setName("spawn")
        .setDescription("Start an ad hoc agent.")
        .addStringOption((option) => option.setName("project").setDescription("Project slug").setRequired(true))
        .addStringOption((option) => option.setName("prompt").setDescription("Task prompt").setRequired(true))
        .addStringOption((option) => option
          .setName("mode")
          .setDescription("Autonomy mode")
          .addChoices({ name: "plan-gated", value: "plan-gated" }, { name: "automatic", value: "automatic" })
          .setRequired(false)))
      .addSubcommand((sub) => sub
        .setName("approve")
        .setDescription("Approve a plan-gated run.")
        .addStringOption((option) => option.setName("run").setDescription("Run ID").setRequired(true))
        .addStringOption((option) => option.setName("feedback").setDescription("Optional feedback").setRequired(false)))
      .addSubcommand((sub) => sub
        .setName("cancel")
        .setDescription("Cancel a running agent.")
        .addStringOption((option) => option.setName("run").setDescription("Run ID").setRequired(true)))
      .addSubcommand((sub) => sub
        .setName("status")
        .setDescription("List active runs."))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("memory")
      .setDescription("Search or write Vesper memory.")
      .addSubcommand((sub) => sub
        .setName("search")
        .setDescription("Search project memory.")
        .addStringOption((option) => option.setName("project").setDescription("Project slug").setRequired(true))
        .addStringOption((option) => option.setName("query").setDescription("Search query").setRequired(true)))
      .addSubcommand((sub) => sub
        .setName("write")
        .setDescription("Write project memory.")
        .addStringOption((option) => option.setName("project").setDescription("Project slug").setRequired(true))
        .addStringOption((option) => option.setName("title").setDescription("Title").setRequired(true))
        .addStringOption((option) => option.setName("content").setDescription("Memory content").setRequired(true)))
      .toJSON(),
  ];
}

export async function registerCommands(input: {
  token: string;
  clientId: string;
  guildId: string;
}): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(input.token);
  await rest.put(
    Routes.applicationGuildCommands(input.clientId, input.guildId),
    { body: commandPayloads() },
  );
}
