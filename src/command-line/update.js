"use strict";

const program = require("commander");
const Utils = require("./utils");

program
	.command("update")
	.description("Update all themes/packages")
	.on("--help", Utils.extraHelp)
	.action(require("../plugins/packageManager").update);
