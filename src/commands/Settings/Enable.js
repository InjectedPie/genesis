'use strict';

const Command = require('../../models/Command.js');
const EnableUsageEmbed = require('../../embeds/EnableUsageEmbed.js');
const EnableInfoEmbed = require('../../embeds/EnableInfoEmbed.js');
const { getTarget, getChannels } = require('../../CommonFunctions.js');

class Enable extends Command {
  constructor(bot) {
    super(bot, 'settings.enable', 'enable', 'Enable a command.');
    this.usages = [
      { description: 'Enable a command for a role in a channel or channels', parameters: ['command id> in <channel> for <role|user'] },
    ];
    this.regex = new RegExp(
      `^${this.call}(?:\\s+(\\w*\\.*\\w*\\.*\\w*\\*?)(?:\\s+in\\s+((?:\\<\\#)?\\d+(?:\\>)?|here|\\*))?(?:\\s+for\\s((?:\\<\\@\\&?)?\\d+(?:\\>)?|\\*))?)?`,
      'i',
    );
    this.requiresAuth = true;
    this.blacklistable = false;
    this.allowDM = false;
  }

  async run(message) {
    const params = message.strippedContent.match(this.regex);
    if (!params[1]) {
      this.messageManager.embed(message, new EnableUsageEmbed(this.bot, params, 1), true, false);
      return this.messageManager.statuses.FAILURE;
    }
    params.splice(0, 1);
    const commands = this.getCommandsToEnable(params[0]).filter(command => typeof command !== 'undefined');
    let channels = [];

    if (params[1]) {
      channels = getChannels(message.mentions.channels.length > 0
        ? message.mentions.channels : params[1].trim().replace(/<|>|#/ig, ''), message);
    }
    channels = channels.filter(channel => typeof channel !== 'undefined');
    if (!channels.length) {
      channels = [message.channel];
    }

    // targets
    let target = {};

    if (params[2] || message.mentions.roles.size > 0 || message.mentions.users.size > 0) {
      target = getTarget(
        params[2], message.mentions ? message.mentions.roles : [],
        message.mentions ? message.mentions.users : [], message,
      );
    } else {
      target = getTarget(
        params[1], { first: () => undefined },
        { first: () => undefined }, message,
      ) || message.guild.defaultRole;
    }

    const results = [];
    // set the stuff
    commands.forEach((command) => {
      channels.forEach((channel) => {
        if (!channel) return;
        try {
          if (target.type === 'Role') {
            results.push(this.settings
              .setChannelPermissionForRole(channel, target, command, 1));
          } else {
            results.push(this.settings
              .setChannelPermissionForMember(channel, target, command, 1));
          }
        } catch (error) {
          this.logger.error(error);
        }
      });
    });
    await Promise.all(results);
    // notify info embed
    const infoEmbed = new EnableInfoEmbed(this.bot, 1, [commands, channels, target.toString()]);
    const respondToSettings = await this.settings
      .getChannelSetting(message.channel, 'respond_to_settings');
    if (respondToSettings) {
      this.messageManager.embed(message, infoEmbed, true, false);
    }
    return this.messageManager.statuses.SUCCESS;
  }

  /**
   * Get the list of commands based on input
   * @param {string} commandIdParam parameter for determining commands
   * @returns {Array<string>} command ids to enable
   */
  getCommandsToEnable(commandIdParam) {
    const commandsToEnable = [];
    const commandRegex = new RegExp(commandIdParam.replace('.', '\\.').replace('*', '.*'), 'ig');
    const commands = this.commandManager.commands
      .concat(this.commandManager.inlineCommands || [])
      .concat(this.commandManager.customCommands || []);
    commands.forEach((command) => {
      if (commandRegex.test(command.id) && command.blacklistable) {
        commandsToEnable.push(command.id);
      }
    });
    return commandsToEnable;
  }
}

module.exports = Enable;
