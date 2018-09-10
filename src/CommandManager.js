'use strict';

const fs = require('fs');
const path = require('path');
const decache = require('decache');

const commandDir = path.join(__dirname, 'commands');

/**
 * Describes a CommandHandler for a bot.
 */
class CommandManager {
  /**
   * Constructs CommandHandler
   * @param {Genesis} bot    Bot to derive prefix for commands from,
   * @param {JSON} commandManifest Command manifest
   */
  constructor(bot, commandManifest) {
    this.bot = bot;
    this.logger = bot.logger;

    /**
     * Array of command objects that can be called
     * @type {Array<Command>}
     * @private
     */
    this.commands = commandManifest ? commandManifest.filter(cmd => !cmd.isCustomCommand) : [];

    /**
     * Array of custom comamnd objects that can be called
     * @type {Array<Command>}
     * @private
     */
    this.customCommands = [];

    /**
     * [statuses description]
     * @type {[type]}
     */
    this.inlineCommands = commandManifest ? commandManifest.filter(cmd => cmd.isCustomCommand) : [];

    this.commandCache = {};
  }

  async loadCommand(manifest) {
    if (this.commandCache[manifest.id]) {
      this.logger.debug(`Found ${manifest.id} in cache`);
      return this.commandCache[manifest.id];
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const Command = require(path.join(commandDir, manifest.path));
    const command = new Command(this.bot);
    this.logger.debug(`Loading ${command.id}`);
    this.commandCache[manifest.id] = command;
    return command;
  }

  /**
   * Loads the commands from disk into this.commands
   */
  async loadCommands() {
    if (!this.commands.length) {
      let files = fs.readdirSync(commandDir);

      const categories = files.filter(f => f.indexOf('.js') === -1);
      files = files.filter(f => f.indexOf('.js') > -1);

      categories.forEach((category) => {
        files = files.concat(fs.readdirSync(path.join(commandDir, category))
          .map(f => path.join(category, f)));
      });

      if (this.commands.length !== 0) {
        this.logger.debug('Decaching commands');
        files.forEach((f) => {
          decache(path.join(commandDir, f));
        });
      }

      const commands = files.map((f) => {
        try {
          // eslint-disable-next-line import/no-dynamic-require, global-require
          const Cmd = require(path.join(commandDir, f));
          if (Object.prototype.toString.call(Cmd) === '[object Function]') {
            const command = new Cmd(this.bot);

            return command;
          }
          return null;
        } catch (err) {
          this.logger.error(err);
          return null;
        }
      }).filter(c => c);

      this.commands = commands.filter(c => !c.isInline);

      this.inlineCommands = commands.filter(c => c.isInline);
    }

    await this.loadCustomCommands();
  }

  async loadCustomCommands() {
    this.customCommands = await this.bot.settings.getCustomCommands();
  }
}

module.exports = CommandManager;
