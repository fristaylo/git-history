import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const vsix = `${pkg.name}-${pkg.version}.vsix`
if (!existsSync(vsix)) throw new Error(`${vsix} не найден, сначала соберите .vsix`)

const files = [vsix, 'README.md', 'CHANGELOG.md', pkg.icon].filter((f) => f && existsSync(f))
const dir = mkdtempSync(join(tmpdir(), 'ext-npm-'))
for (const f of files) cpSync(f, join(dir, f))

const { scripts, devDependencies, dependencies, ...manifest } = pkg
writeFileSync(
	join(dir, 'package.json'),
	JSON.stringify(
		{
			...manifest,
			name: pkg.name.toLowerCase(),
			keywords: [...(pkg.keywords ?? []), 'yummygroup-vscode'],
			files,
		},
		null,
		2,
	),
)

try {
	execSync(['npm publish --access public', ...process.argv.slice(2)].join(' '), { cwd: dir, stdio: 'inherit' })
} finally {
	rmSync(dir, { recursive: true, force: true })
}
