import "dotenv/config";
import { MarketAnalyticsEngine } from "./src/main.js";

const engine = new MarketAnalyticsEngine();

const HELP_TEXT = `Local Market Estimator

Commands:
	types
		List supported business types.

	exec --name "Business Name" --address "Full Address, Postcode, Country" --type "businessType" [--radius 10000] --pricing "[{\"title\":\"Basic\",\"price\":25}]" [--verbose]
		Run revenue estimation.

Notes:
	- businessType is required for exec.
	- pricing is required.
	- --verbose includes formatted report output.
`;

const EXEC_FLAG_MAP = {
	"--name": "businessName",
	"--address": "address",
	"--type": "businessTypeInput",
	"--business-type": "businessTypeInput",
	"--radius": "radiusInput",
	"--pricing": "pricingInput",
};

function parseRadius(rawRadius) {
	if (!rawRadius) return undefined;

	const parsed = Number(rawRadius);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error("Radius must be a positive number in meters.");
	}

	return parsed;
}

function parsePricing(rawPricing) {
	if (!rawPricing) {
		throw new Error(
			'Pricing is required. Provide pricing JSON like "[{\"title\":\"Basic\",\"price\":25}]".'
		);
	}

	let parsed;
	try {
		parsed = JSON.parse(rawPricing);
	} catch {
		throw new Error(
			"Pricing must be valid JSON, e.g. '[{\"title\":\"Basic\",\"price\":25}]'."
		);
	}

	if (!Array.isArray(parsed) || parsed.length === 0) {
		throw new Error("Pricing must be a non-empty JSON array.");
	}

	const normalized = parsed.map((item) => ({
		title: String(item?.title || "").trim(),
		price: Number(item?.price),
	}));

	const hasInvalid = normalized.some(
		(item) => !item.title || !Number.isFinite(item.price) || item.price < 0
	);

	if (hasInvalid) {
		throw new Error("Each pricing item must include title and price >= 0.");
	}

	return normalized;
}

function printSupportedBusinessTypes() {
	console.log("Supported business types:");
	engine.getSupportedBusinessTypes().forEach((businessType) => console.log(`- ${businessType}`));
}

function parseExecArgs(args) {
	const execArgs = [...args];
	let verboseReport = false;

	const parsedFlags = {
		businessName: undefined,
		address: undefined,
		businessTypeInput: undefined,
		radiusInput: undefined,
		pricingInput: undefined,
	};

	for (let i = 0; i < execArgs.length; i += 1) {
		const token = execArgs[i];

		if (token === "--verbose") {
			verboseReport = true;
			continue;
		}

		const target = EXEC_FLAG_MAP[token];
		if (!target) {
			throw new Error(`Unknown exec argument: ${token}. Use --help for usage.`);
		}

		const value = execArgs[i + 1];
		if (value === undefined || value.startsWith("--")) {
			throw new Error(`Missing value for ${token}. Use --help for usage.`);
		}

		parsedFlags[target] = value;
		i += 1;
	}

	const { businessName, address, businessTypeInput, radiusInput, pricingInput } = parsedFlags;

	if (!businessName || !address || !businessTypeInput) {
		throw new Error(
			'Missing required exec args. Required: --name, --address, --type. Use --help for usage.'
		);
	}

	const businessType = engine.resolveBusinessType(businessTypeInput);
	if (!businessType) {
		console.error("Unsupported business type");
		printSupportedBusinessTypes();
		process.exit(1);
	}

	if (!pricingInput) {
		throw new Error(
			'Missing required pricing for exec. Use --pricing and see --help for usage.'
		);
	}

	return {
		businessName,
		address,
		businessType,
		radiusMeters: parseRadius(radiusInput),
		pricingOptions: parsePricing(pricingInput),
		verboseReport,
	};
}

function parseCliCommand(argv = process.argv) {
	const args = argv.slice(2);

	if (args.includes("--help") || args.includes("-h") || args.length === 0) {
		return { command: "help" };
	}

	const [command, ...rest] = args;

	if (command === "types") {
		return { command: "types" };
	}

	if (command === "exec") {
		return { command: "exec", input: parseExecArgs(rest) };
	}

	throw new Error(`Unknown command: ${command}. Use --help for usage.`);
}

Promise.resolve()
	.then(async () => {
		const parsed = parseCliCommand(process.argv);

		if (parsed.command === "help") {
			console.log(HELP_TEXT);
			return;
		}

		if (parsed.command === "types") {
			printSupportedBusinessTypes();
			return;
		}

		const response = await engine.run(parsed.input);
        console.log( response.summary );
		if (response.cliText) {
			console.log(response.cliText);
		}
	})
	.catch((error) => {
		console.error(`[error] ${error.message}`);
		process.exit(1);
	});
