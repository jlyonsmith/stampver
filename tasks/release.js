const { execSync } = require('child_process')
const { readFileSync } = require('fs')

console.log('Testing...')
execSync('npm test')
console.log('Building...')
execSync('npm run build')
console.log('Updating Version...')
execSync('mkdir -p scratch')
execSync('npx stampver -i patch -u')
console.log('Tagging...')
const tagName = readFileSync('scratch/version.tag.txt')
const tagDescription = readFileSync('scratch/version.desc.txt')
execSync(`git tag -a ${tagName} -m '${tagDescription}'`)
console.log('Committing...')
execSync(`git add :/`)
execSync(`git commit -m '${tagDescription}'`)
console.log('Pushing...')
execSync('git push --follow-tags')
console.log('Publishing...')
execSync('npm publish')
