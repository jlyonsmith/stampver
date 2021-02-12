# Version Stamping Tool

![GitHub package.json version](https://img.shields.io/github/package-json/v/jlyonsmith/stampver) ![Code coverage](https://img.shields.io/badge/coverage-100%25-green) ![npm](https://img.shields.io/npm/dm/@johnls/stampver) ![GitHub](https://img.shields.io/github/license/jlyonsmith/stampver)

## Overview

This is a tool for updating version information in many types of software projects.  It stores version information in a JSON file at the root of the project. The file also contains information on how to update the various files within the project that contain version information.  This version file completely specifies how versioning works in the project and can be fully costomized. The tool has no opinion on how you do your versioning.

For this project, we had the following goals.  It must be able to:

- Look at version file and see the list of affected files and the current version information *clearly*
- Be flexible enough to fully customize version numbers and update strategy
- Reliably update any *text file* with new version information
- Perform update-in-place, write-new and copy-in functions on files

The tool supports [Semantic Versioning](https://semver.org/) easily, but it can also support other the many other types of versioning strategies in use.

The version file can also contain other arbitrary and useful data such as copyright information and project names.

## Installation

Install it globally with:

```Shell
npm install -g @johnls/stampver
```

With Node 8.0 and above you can just run it with `npx`:

```Shell
npx @johnls/stampver ...
```

## Usage

To run tool the and check everything is set up correctly run:

```Shell
stampver --help
```

You'll need to create a `version.json5` file in the root of your project. See the next section on how to do this. Then you can do a dry run update by running:

```Shell
stampver <version-operation>
```

where `version-operation` is something you define in your `version.json5`.  The program does the following:

1. Read the `version.json5` file in
2. Do any dynamic calculations of version information, such as generating a date based `build` value.
3. Increment or do some other operation on the `vars` information as specified on the command line
4. Update a list of files with the new version information using regular expression search & replace, or directly write files or copy specific files into place.
5. Write out the `version.json5` file with updated `vars`

## `version.json5` File Format

The file is in JSON5 format with an object at the root containing the following properties.  You can examine and copy this projects `version.json5` file for a starting point.

### `vars`

A list of strings containing version information.  `major`, `minor`, `patch`, `build` and `revision` are common but not required.

## `calcVars`

A list of interpolated strings that can calculate additional variables in the [run context](#run-context).

A `now` variable is automaticall added to [run context](#run-context) containing `year`, `month`, `day`, `hour`, `minute` and `second` properties for the time the program is run.  The `tz` variable, if present in `vars`, must contain a [TZ database name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).  This will be used to localize the `now` variable.

An `env` is automatically added containing a snapshot of `process.env`.

## `operations`

This is a list of scripts that modify the run context. Only one operation is run as specified on the command line.

## `targets`

This is an array of objects containing `files`, `description`, `action` properties. The files in the `files` array will all be updated. Any paths are relative to the `version.json5` file directory.

`description` is only for informational purposes.

There are 3 types of `action`

### `updates`

Updates is an array of objects. Each object contains `search` and `replace` fields.  There can be multple updates per target file.  The `search` string is a regular expression which can contain named matches. The `replace` string is a script that generates the replacement text if `search` matches.

### `write`

The `write` property is a script that generates the contents of the target file.

### `copyFrom`

The `copyFrom` property is a script that generates the name of a file to copy from.

## Run Context

The `calcVars`, `operation`, `search`, `replace`, `write` and `copyFrom` fields allow you to specify a string or an *embedded JavaScript* code. Embedded code is specified by putting `{...}` around the _entire_ string.  For example:

```json5
{
  operations: {
    incrMajor: "{major += 1; minor = 0}",
  }
}
```

The `incrMajor` operation will add one to the `major` variable and set `minor` to zero.  These scripts will be executed, or *interpolated*, using the NodeJS [VM package](https://nodejs.org/api/vm.html) using a shared *global run context*. This context is created once and used throughout the script.  Scripts can access this run context and read or modify the values of earlier script actions. The context lifetime proceeds as follows:

1. The run context is initialized with an `env` variable containing a snapshot of `process.env`
2. A `now` variable is added (see below).  If the `tz` variable is present the values in `now` are specific to the `tz` time zone.
3. All other `vars` properties are set as variables in the context. `vars` variables are not expected to contain JavaScript i.e. they are constants.
4. `calcVars` are assumed to be script.  They are interpolated and can update the run context.
5. `operations` are assumed to be script.  The one selected on the command line is interpolated.
6. A `targets` are run the following can affect context:
   1. `updates`: as each `search` completes any captured variables are added to the context, e.g. `begin` and `end` are common captures.  The `replace` value is interpolated. It's common to use a [JS template literal](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) to construct the `replace` string.  Capture variables are removed from the context after each update is performed.
   2. `with`: the contents of the file to be written are interpolated.
   3. `copyFrom`: the path name of the file that is to be copied are interpolated

All [JS String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) operations are available as well as `Math` and anything that does not need to be `require`'d.

The interpolation feature is meant to be used to make the tool adaptable to different versioning strategies.  You could get yourself in a real mess if you try to do anything too crazy.  Check the source code if in doubt.

## About

`stampver` is written in [TypeScript](https://www.typescriptlang.org/) and built to target [NodeJS](https://nodejs.org/) 10 or above.

I've used my own fork of [JSON5](http://json5.org/) for the version file format. JSON5 is easy to type and maintain. The fork includes the ability to get line and column information for the parsed JSON5 to provide for better error messages.

I've used [XRegExp](http://xregexp.com/) because it supports named groups.
