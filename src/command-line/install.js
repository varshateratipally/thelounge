"use strict";

const program = require("commander");
const Utils = require("./utils");

program
	.command("install <package>")
	.description("Install a theme or a package")
	.on("--help", Utils.extraHelp)
	.action(require("../plugins/packageManager").install);
