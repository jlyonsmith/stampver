# Version Stamping Tool

## Why Build This?

This is a tool for updating version numbers.  It allows you to keep your version numbers and version related information in a single file in the root of your project, and then easily generate all other files contain different bits of that information that are needed by your project and release process.

This approach also supports multi-language, multi-platform projects very well. For example, a React Native project that includes Node.js, Swift and Java code targeting the web, iOS and Android.

The tool is based around the following version numbers:

- `major`, `minor` and `patch` are numbers that increase by one for each major, minor or patch release
- `build` is a number based on the current date in a sortable year, month, day order
- `revision` is a number that increases by one for each build done on the build date
- `sequence` is just a number that increases by one whenever you tell it too (mostly used by Android apps)

This means the tool supports [Semantic Versioning](https://semver.org/) out of the box, but it can also support other types of versioning.

The tool works using a single `version.json5` file in the root of your project.  In that file you place:

1. Version information.
2. Other information like copyrights, project starting years, etc..
3. A list of files to update
4. A list of regular expression based search and replacements to use to update version numbers in the list of files.

## Getting Started

### Installation

Install it globally with:

```Shell
npm install -g stampver
```

Or, with Node 8.0 and above you can just run it with:

```Shell
npx stampver
```

### Running the tool

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

Here is an example `version.json5` file which should be placed in the root of your project tree:

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
    sequence: 1,
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

```json5
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

```json5
{
  name: "Node Package",
  glob: "**/package.json",
  update: {
    search: "^(?<begin> *\"version\" *: *\")\\d+\\.\\d+\\.\\d+(?<end>\" *, *)$",
    replace: "${begin}${major}.${minor}.${patch}${end}"
  }
},
```

```json5
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

`stampver` is written in ES2019 Javascript using `babel` and built to target [NodeJS](https://nodejs.org/) v8 or above.

I've used [JSON5](http://json5.org/) for the version file format because it is easier to type and maintain.  However the file is rewritten each time version information is updated, so any embedded comments will be lost.

I've used [XRegExp](http://xregexp.com/) because it supports named groups.
