"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testCommand = void 0;
exports.assertConfigsCount = assertConfigsCount;
const node_worker_threads_1 = require("node:worker_threads");
const node_events_1 = require("node:events");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const commander_1 = require("commander");
const generate_1 = require("../../generate");
const loadConfig_1 = require("../../playwright/loadConfig");
const env_1 = require("../../config/env");
const exit_1 = require("../../utils/exit");
const defaults_1 = require("../../config/defaults");
const bddgenPhase_1 = require("../helpers/bddgenPhase");
const warnings_1 = require("../../config/warnings");
const logger_1 = require("../../utils/logger");
const GEN_WORKER_PATH = node_path_1.default.resolve(__dirname, '..', 'worker.js');
const DEFAULT_WORKERS = Math.max(1, Math.floor((node_os_1.default.availableParallelism?.() ?? node_os_1.default.cpus().length) / 2));
exports.testCommand = new commander_1.Command('test')
    .description('Generate Playwright test files from Gherkin documents')
    .configureHelp({ showGlobalOptions: true })
    .option('--tags <expression>', `Tags expression to filter scenarios for generation`)
    .option('--verbose', `Verbose mode (default: ${Boolean(defaults_1.defaults.verbose)})`)
    .option('--workers <number>', `Max parallel worker threads for generation (default: ${DEFAULT_WORKERS})`)
    .action(async () => {
    const opts = exports.testCommand.optsWithGlobals();
    (0, bddgenPhase_1.setBddGenPhase)();
    await (0, loadConfig_1.loadConfig)(opts.config);
    const configs = readConfigsFromEnv();
    mergeCliOptions(configs, opts);
    const isVerbose = hasVerboseFlag(configs);
    const workers = parseWorkers(opts.workers);
    await generateFilesForConfigs(configs, workers);
    if (isVerbose)
        printDone();
});
function readConfigsFromEnv() {
    const configs = Object.values((0, env_1.getEnvConfigs)());
    assertConfigsCount(configs);
    (0, warnings_1.showWarnings)(configs);
    return configs;
}
function mergeCliOptions(configs, opts) {
    configs.forEach((config) => {
        if ('tags' in opts)
            config.tags = opts.tags;
        if ('verbose' in opts)
            config.verbose = Boolean(opts.verbose);
    });
}
function assertConfigsCount(configs) {
    if (configs.length === 0) {
        (0, exit_1.exit)(`No BDD configs found. Did you use defineBddConfig() in playwright.config.ts?`);
    }
}
async function generateFilesForConfigs(configs, concurrency) {
    // run first config in main thread and other in workers (to have fresh require cache)
    // See: https://github.com/vitalets/playwright-bdd/issues/32
    const { default: pMap } = await import('p-map');
    const [firstConfig, ...restConfigs] = configs;
    await new generate_1.TestFilesGenerator(firstConfig).generate();
    if (restConfigs.length > 0) {
        await pMap(restConfigs, (config) => runInWorker(config), { concurrency });
    }
}
function parseWorkers(value) {
    if (value === undefined)
        return DEFAULT_WORKERS;
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 1) {
        (0, exit_1.exit)(`Invalid --workers value: "${value}". Must be a positive integer.`);
    }
    return n;
}
async function runInWorker(config) {
    const worker = new node_worker_threads_1.Worker(GEN_WORKER_PATH, {
        workerData: { config },
    });
    const [exitCode] = await (0, node_events_1.once)(worker, 'exit');
    if (exitCode)
        (0, exit_1.exit)();
}
function hasVerboseFlag(configs) {
    return configs.some((config) => config.verbose);
}
function printDone() {
    const logger = new logger_1.Logger({ verbose: true });
    const duration = process.uptime().toFixed(1);
    logger.log(`Done (${duration}s).`);
}
//# sourceMappingURL=test.js.map