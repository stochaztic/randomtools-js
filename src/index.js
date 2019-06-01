import Random from './random.js';
import ReadWriteObject from './ReadWriteObject.js';
import TableObject from './TableObject.js';
import utils from './utils.js';

const RandomTools = {
    execute: function(context) {
        // run_interface
        if(!context.rom) {
            throw new Error("No ROM provided.");
        }
        if(!context.objects) {
            throw new Error("No objects to randomize provided.");
        }

        context.rom = new Uint8Array(context.rom);
        
        if (context.rom.length % 0x100000 === 0x200) {
            context.hooks.message("SNES header detected. Removing header from output file.");
            context.rom = context.rom.slice(0x200);
        }
        if (context.rom.length % 0x100000 !== 0) {
            throw new Error("Inappropriate file size for SNES rom file.");
        }

        context.hooks = context.hooks || {};
        context.specs = context.specs || {};
        context.specs.title = context.specs.title || "UNKNOWN";
        context.specs.version = context.specs.version || "0.1";
        context.specs.randomDegree = context.specs.randomDegree || 0.5;
        context.specs.randomDegree = context.specs.randomDegree ** 2;
        context.specs.lorom = context.specs.lorom || false; 
        context.specs.seed = context.specs.seed || Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
        
        context.random = Random;
        context.random.seed(context.specs.seed);

        context.specs.rarity = Array.from({length: 10}, () => context.random.random());

        context.hooks.prePatch && context.hooks.prePatch(context);
        utils.writePatches(context);
        context.hooks.postPatch && context.hooks.postPatch(context);

        context.hooks.message("Loading game objects...");
        context.hooks.preLoad && context.hooks.preLoad(context);
        const objects = utils.sortGoodOrder(context.objects);
        objects.forEach(o => {
            o.initialize(context);
        })
        context.hooks.postLoad && context.hooks.postLoad(context);

        context.hooks.preRandomize && context.hooks.preRandomize(context);
        objects.forEach(o => {
            if(o.shouldRandomize()) {
                context.hooks.message("Randomizing " + o.displayName);
                context.random.seed(context.specs.seed);
                o.fullRandomize();
            }
            o.randomizeStepFinished = true;
        });
        context.hooks.postRandomize && context.hooks.postRandomize(context);

        // clean_and_write
        context.hooks.preClean && context.hooks.preClean(context);
        objects.forEach(o => {
            context.hooks.message("Cleaning " + o.displayName);
            context.random.seed(context.random.getSeed()+1);
            o.fullCleanup();
        });
        context.hooks.postClean && context.hooks.postClean(context);
    
        context.hooks.message("Saving game objects...")
        context.hooks.preSave && context.hooks.preSave(context);
        objects.forEach(o => {
            o.writeAll();
        })
        context.hooks.postSave && context.hooks.postSave(context);
    
        utils.verifyPatches(context);
        utils.rewriteSnesMeta(context);
        context.hooks.complete && context.hooks.complete(context);
        return context.rom;
    },

    //ReadWriteObject: ReadWriteObject,
    //TableObject: TableObject,
    //utils: utils,
}

export default RandomTools;
export { ReadWriteObject, TableObject, utils };