# Version Stamping Tool

## Why Build This?

This is a tool for updating version numbers.  It would be wonderful if project version information could be defined in just one file and then be accessed from everywhere, but unfortunately that is never the case for multi-platform projects.

There are two approaches to generating version information.

1. Generating version files that are then incorporated into projects builds.
2. Searching and replacing version information where it appears in various types of project files.

This tool supports both of the above.  If your version information appears in a searchable text file, it can updated. Or, you can write version information to specific files.

So if, for example, your project contains some NodeJS, C++, iOS and Android code, then you can generate or replace those version numbers in situ as needed using `stampver`.

`npm version` provides version updating for the [npm](https://npmjs.org/) `package.json`, but not other types of project files. You can use `stampver` to easily update `package.json` files.

## Getting Started

Install it globally with:

```Shell
npm install -g stampver
```

Or, with Node 8.0 and above you can just run it with:

```Shell
npx stampver
```

These instructions assume that you have the tool installed globally for simplicity.

Create a basic `version.json5` file in the root of your project tree:

```JSON5
{
  filenames: [
    "file.qpr"
    "src/file.abc",
    "task/file.xyz",
  ],
  buildFormat: "full",
  tags: {
    major: 1,
    minor: 0,
    patch: 1,
    build: 20171005,
    revision: 0,
    tz: "America/Los_Angeles",
    startYear: "2017",
    company: "My Company",
    product: "myproject"
  },
  fileTypes: [
    {
      name: "File Type QPR",
      glob: "**/file.qpr",
      update: {
        search: "...",
        replace: "..."
      }
    },
    {
      name: "File Type ABC",
      glob: "**/file.abc",
      updates: [
        {
          search: "...",
          replace: "..."
        },
        {
          search: "...",
          replace: "..."
        }
      ]
    },
    {
      name: "File Type XYZ",
      glob: "**/*.xyz",
      write: "..."
    }
  ]
}
```

This file isn't yet valid, so read the next section for figure out how to set it up.  Also, you can look at this project in [GitHub](https://github.com/jlyonsmith/stampver) to see how things are set up there.

## Usage

This tool assumes you are using [Semantic Versioning](http://semver.org/).  It could be used with other versioning schemes that know about the following version numbers:

- `major` for incompatible changes
- `minor` for added functionality with backward compatibility
- `patch` for backwards compatible bug fixes
- `build` for daily builds
- `revision` for revision to daily builds

The latter two values are used for pre-release versions and for internal build tracking. Each value is an integer.

So a semantic version using the above would look like `major.minor.patch`.  A _pre-release_, _internal_ or _full_ version number might look like `major.minor.patch-build.revision`.

To run tool the and check everything is set up correctly run:

```Shell
stampver
```

To actually do an update of the build and/or revision number do:

```Shell
stampver --update
```

This will rewrite all the files specified in the `version.json5` file.  To increment the major, minor or patch number do:

```Shell
stampver --update --increment patch
```

See `--help` for more options and `--version` for, well, the version number.

## `version.json5` File Format

The file has the following sections.

### `filenames`

An array of files names. Use relative paths rooted at the location of the `version.json5` file.  

### `buildFormat`

Format for the build number.  Can be:

- `full` - the build number is the current date at the given timezone in year/month/day order
- `jdate` - the build number is 3 pairs of digits; the number of years since `startYear`, the month and the day. Keeps the build number under the size of a 16-bit integer value.
- `incr` - the build number is simply an incremented number

### `tags`

This is the set of tags for the project including the version information.  The following is the list of system managed tags.  All other tags are ignored and can be used by in `replace` strings.

- `major`, `minor`, `patch`, `build`, `revision` - as described above
- `startYear` - the year the project was started, for use with `jdate` `build` value
- `tz` - the timezone that should be used to generate a `full` `build` value.  See [MomentJS Timezone](https://momentjs.com/timezone/) for a full list of available timezones.

All other values, such as `company` or `product` are user maintained and can be substituted into files as needed.

### `fileTypes`

This section describes the types of files that the can be listed in the `filenames` section.  A `fileType` consists of:

- `name` - For reporting
- `glob` - To match the `filename`
- `update` or `updates` - A single or array of `search`/`replace` pairs
- `write` - The contents to write to a file.  The file will be created, but any directory given must exist.

Within the `search` tag you can use any [XRegExp](http://xregexp.com/) search syntax, in particular named match groups, e.g. `(?<name>...)`  These will be available in the `replace` as `${name}`.  It is common to capture text surrounding the match as groups so they can be substituted back into the replacement string, e.g. `(?<begin>...)` and `(?<end>...)` translating to `${begin}` and `${end}`.

Within the `replace` tag you can use any values listed in `tags` and any named match groups from the `search` expression.

## Common `fileTypes`

Here is the JSON5 for some common file types that you can use as starting points for your projects:

```JSON5
{
  name: "Javascript File",
  glob: "**/version.js",
  updates: [
    {
      search: "^(?<begin>\\s*export\\s*const\\s*version\\s*=\\s*')\\d+\\.\\d+\\.\\d+(?<end>'\\s*)$",
      replace: "${begin}${major}.${minor}.${patch}${end}"
    },
    {
      search: "^(?<begin>\\s*export\\s*const\\s*fullVersion\\s*=\\s*')\\d+\\.\\d+\\.\\d+-\\d+\\.\\d+(?<end>'\\s*)$",
      replace: "${begin}${major}.${minor}.${patch}-${build}.${revision}${end}"
    }
  ]
},
```

```JSON5
{
  name: "Node Package",
  glob: "**/package.json",
  update: {
    search: "^(?<begin> *\"version\" *: *\")\\d+\\.\\d+\\.\\d+(?<end>\" *, *)$",
    replace: "${begin}${major}.${minor}.${patch}${end}"
  }
},
```

```JSON5
{
  name: "Commit tag file",
  glob: "**/*.tag.txt",
  write: "v${major}.${minor}.${patch}"
},
{
  name: "Commit tag description file",
  glob: "**/*.desc.txt",
  write: "Version ${major}.${minor}.${patch}-${build}.${revision}"
}
```

## About

`stampver` is written in ES6 Javascript using `babel` and built to target [NodeJS](https://nodejs.org/) v8 or above.

I've used [JSON5](http://json5.org/) for the version file format because it is easier to type and maintain.  However the file is rewritten each time version information is updated, so any embedded comments will be lost.

I've used [XRegExp](http://xregexp.com/) because it supports named groups.
