const fs = require('fs');
const fetch = require('node-fetch');

const current_dir = '/home/alipha/repos/weechat-godbolt';

async function format(code) {
	const request = {
		language: 'cpp',
		codeSrc: encodeURIComponent(code),
		style: 'Chromium',
		indentWidth: '4',
		columnLimit: '80'
	};
	//const body = JSON.stringify(request);
	//console.log(body);
	
	const resp = await fetch('https://formatter.org/admin/format', { 
		method: 'POST', 
		headers: { 'Accept': 'application/json; charset=utf-8' },
		body: JSON.stringify(request)
	});

	return (await resp.json()).codeDst;
}

async function createPaste(code, version) {
	let payload = JSON.parse(fs.readFileSync(current_dir + '/godbolt_post.json', 'utf-8'));
	payload.config.content[0].content[0].content[0].componentState.source = code;
	payload.config.content[0].content[1].content[0].content[0].componentState.options =
		'-std=c++' + version + ' ' + payload.config.content[0].content[1].content[0].content[0].componentState.options;
	payload.config.content[0].content[1].content[1].content[0].componentState.options =
		'-std=c++' + version + ' ' + payload.config.content[0].content[1].content[1].content[0].componentState.options;

	const resp = await fetch('https://godbolt.org/api/shortener', {
		method: 'POST',
		headers: { 
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	});

	//console.log((await resp.text()));
	const respJson = await resp.json();
	//console.log(respJson);
	return respJson.url;
}

function split(cmd, separator) {
	let i = 0;
	let inComment = false;
	let inQuotes = false;
	let inSingleQuotes = false;
	let bracketStack = [];
	while(i < cmd.length && (inComment || inQuotes || inSingleQuotes || bracketStack.length > 0 || cmd[i] !== separator)) {
		//if(cmd[i] === separator) {
		//	console.log({ i, inComment, inQuotes, inSingleQuotes, bracketStack });
		//}
		const ch = cmd[i];
		if(inQuotes && ch == '"') {
			inQuotes = false;
		} else if(inSingleQuotes && ch == "'") {
			inSingleQuotes = false;
		} else if(inComment && cmd.substring(i, i + 2) == '*/') {
			++i;
			inComment = false;
		} else if((inQuotes || inSingleQuotes) && ch == '\\') {
			++i;
		} else if(inQuotes || inSingleQuotes || inComment) {
			// do nothing
		} else if(ch == '"') {
			inQuotes = true;
		} else if(ch == "'") {
			inSingleQuotes = true;
		} else if(cmd.substring(i, i + 2) == '/*') {
			inComment = true;
		} else if('[{('.indexOf(ch) >= 0) {
			bracketStack.push(ch);
		} else if(']})'.indexOf(ch) >= 0) {
			if(bracketStack.length === 0)
				throw new Error('Unbalanced ' + ch);
			const topCh = bracketStack.pop();
			if(topCh === '[' && ch === ']') {}
			else if(topCh === '{' && ch === '}') {}
			else if(topCh === '(' && ch === ')') {}
			else throw new Error('Unbalanced ' + ch);
		}
		++i;
	}
	if(inComment)
		throw new Error('Unterminated block comment');
	if(inQuotes)
		throw new Error('Unterminated string literal');
	if(inSingleQuotes)
		throw new Error('Unterminated char literal');
	if(bracketStack.length > 0)
		throw new Error('Unbalanced ' + bracketStack[0]);
	//console.log(i + ' ' + cmd.length);
	return { before: cmd.substring(0, i), after: cmd.substring(i + 1) };
}

async function run(cmd) {
	cmd = cmd.trim();
	if(cmd.startsWith('geordi'))
		cmd = cmd.substring(7).trim();

	if(cmd == '') return;

	const main = '\n\nint main(int argc, char **argv) ';
	let preamble = '#include <https://pjboy.cc/util.h>\n#include <bits/stdc++.h>\n\n';
	//fs.readFileSync('godbolt_preamble.cpp', 'utf-8');

	let usingStd = true;
	let version = '23';

	let hasArgs = true;
	while(hasArgs) {
		hasArgs = false;

		if(cmd.startsWith('-w')) {
			cmd = cmd.substring(3).trim();
			hasArgs = true;
		}

		if(cmd.startsWith('--no-using-std')) {
			cmd = cmd.substring(14).trim();
			hasArgs = true;
			usingStd = false;
		}

		if(cmd.startsWith('--1998') || cmd.startsWith('--20')) {
			version = cmd.substring(4, 6);
			cmd = cmd.substring(6).trim();
			hasArgs = true;
		}
	}

	if(usingStd) {
		preamble += 'using namespace std;\n\n';	// TODO (include https://... instead?)
	}

	// TODO:
	// \
	// \\

	let code = '';
	if(cmd.startsWith('{')) {
		const { before, after } = split(cmd.substring(1), '}');
		code = after + main + '{\n' + before + '\n}';
	} else if(cmd.startsWith('<<')) {
		const { before, after } = split(cmd, ';');
		code = after + main + '{\nstd::cout ' + before + ';\n}';
	} else {
		code = cmd;
	}

	//console.log('code: ' + code);
	const formatted = preamble + await format(code);
	//console.log('formatted: ' + formatted);
	console.log(await createPaste(formatted, version));

	//console.log(preamble + code);
}


run(fs.readFileSync(0, 'utf-8'));
