const utils = {
    md5hash: function() {
        throw new Error("Unimplemented");
    },

    intToBytes: function() {
        throw new Error("Unimplemented");
    },
    /*,(value, length=2, reverse=True):
    # reverse=True means high-order byte first
    bs = []
    while value:
        bs.append(value & 255)
        value = value >> 8

    while len(bs) < length:
        bs.append(0)

    if not reverse:
        bs = reversed(bs)

    return bs[:length]*/


    readMulti: function(rom, address, length = 2, reverse = true) {
        let vals = rom.slice(address, address + length);
        if(reverse) {
            vals.reverse();
        }
        let value = 0;
        vals.forEach(val => {
            value = value << 8;
            value = value | val;
        })
        return value;
    },


    writeMulti: function(rom, address, value, length = 2, reverse = true) {
        const vals = [];
        while(value) {
            vals.push(value & 0xFF);
            value = value >>> 8;
        }
        if(vals.length > length) {
            throw new Error("Value length mismatch.");
        }
        while(vals.length < length) {
            vals.push(0x00);
        }
        if(!reverse) {
            vals.reverse();
        }
        rom.set(vals, address);
    },

    lineWrap: function() {
        throw new Error("Unimplemented");
    },
    /*(things, width=16):
    newthings = []
    while things:
        newthings.append(things[:width])
        things = things[width:]
    return newthings*/

    hexstring: function() {
        throw new Error("Unimplemented");
    },
    /*(value):
    if type(value) is str:
        value = "".join(["{0:0>2}".format("%x" % ord(c)) for c in value])
    elif type(value) is int:
        value = "{0:0>2}".format("%x" % value)
    elif type(value) is list:
        value = " ".join([hexstring(v) for v in value])
    return value*/

    generateName: function() {
        throw new Error("Unimplemented");
    },

    getSnesPaletteTransformer: function() {
        throw new Error("Unimplemented");
    },

    snesColorToRgb: function(data) {
        // snes color format is RGB555; 0BBBBBGG GGGRRRRR
        const color = {
            r: (data % 32) * 8,
            g: (Math.floor(data/32) % 32) * 8,
            b: (Math.floor(data/1024) % 32) * 8,
        };
        // Stretch 0-248 range to full 0-255
        Object.keys(color).forEach(key => {
            color[key] = color[key] + (color[key] >> 5);
        });
        return color;
    },

    rgbToSnesColor: function(color) {
        return Math.floor(color.r / 8) + (Math.floor(color.g / 8) * 32) + (Math.floor(color.b / 8) * 1024);
    },

    calcFullChecksum: function(data, mask=0x80000000) {
        while(mask > data.length) {
            mask /= 2;
        }
        if(data.length == mask) {
            return this.calcChecksum(data);
        }
        return (this.calcChecksum(data) + this.calcFullChecksum(data.slice(mask))) & 0xFFFF;
    },
    
    calcChecksum: function(data)
    {
        let sum = 0;
        for (let i = 0; i < data.length; i++)
        {
            sum += data[i];
            sum &= 0xFFFF;
        }
        return sum;
    },

    rewriteSnesTitle: function(rom, text, version, lorom) {
        while(text.length < 20) {
            text += " ";
        }
        if(text.length > 20) {
            text = text.substring(0, 19) + "?";
        }
        const textArray = text.split("").map(x => x.charCodeAt(0));
        if(textArray.length != 20) {
            throw new Error("Invalid characters in title text.");
        }
        const mask = lorom ? 0x7FFF : 0xFFFF;
        rom.set(textArray, 0xFFC0 & mask);
        rom[0xFFDB & mask] = Math.floor(version);
    },

    rewriteSnesChecksum: function(context) {
        const actualSize = context.rom.length;
        if(actualSize & 0x1FFFF) {
            context.hooks.message("WARNING: The rom is a strange size.");
        }
        const mask = context.specs.lorom ? 0x7FFF : 0xFFFF;
        let expectedHeaderSize = 0x9;
        while(actualSize > (1024 << expectedHeaderSize)) {
            expectedHeaderSize += 1;
        }
        if(context.rom[0xFFD7 & mask] != expectedHeaderSize) {
            context.hooks.message("WARNING: Game rom reports incorrect size. Fixing.");
            context.rom[0xFFD7 & mask] = expectedHeaderSize;
        }
        const checksum = this.calcFullChecksum(context.rom);
        this.writeMulti(context.rom, (0xFFDE & mask), checksum, 2);
        this.writeMulti(context.rom, (0xFFDC & mask), checksum ^ 0xFFFF, 2);
    },
    
    rewriteSnesMeta: function(context) {
        context.hooks.message("Rewriting SNES metadata...");
        let degree = Math.floor((context.specs.randomDegree**0.5) * 100);
        if(degree >= 100) {
            degree = "!!";
        }
        this.rewriteSnesTitle(context.rom, context.specs.title + " " + degree + " " + context.specs.seed, context.specs.version, context.specs.lorom);
        this.rewriteSnesChecksum(context);
    },

    standardPatchLoader: function(patchArray) {
        const entries = [];
        patchArray.forEach(rawLine => {
            const line = rawLine.split(";")[0].trim(); // Remove comments
            if(line.length === 0) return;
            const parts = line.split(':').map(v => v.trim()); // See if line contains address
            if(parts.length === 1) {
                // append to previous entry
                const values = parts[0].split(' ').map(v => parseInt(v.trim(), 0x10));
                console.assert(entries.length > 0);
                entries[entries.length - 1].values.push(...values);
            }
            else {
                // create new entry
                let [address, values] = parts;
                address = parseInt(address, 0x10);
                values = values.split(' ').map(v => parseInt(v.trim(), 0x10));
                entries.push({address: address, values: values});
            }
        });
        return entries;
    },

    writePatches: function(context) {
        if(!context.patches) {
            return;
        }
        context.hooks.message("Writing patches...");
        context.patches.forEach(patch => {
            context.hooks.message("Writing patch " + patch.name);
            patch.entries.forEach(entry => {
                context.rom.set(entry.values, entry.address);
            })
        })
    },

    cleanupPatches: function(context) {
        if(!context.patches) {
            return;
        }
        context.hooks.message("Cleaning patches...");
        context.patches.forEach(patch => {
            if(!patch.cleanup) return;
            context.hooks.message("Cleaning patch " + patch.name);
            patch.cleanup(context);
        })
    },

    verifyPatches: function(context) {
        if(!context.patches) {
            return;
        }
        context.hooks.message("Verifying patches...");
        context.patches.forEach(patch => {
            context.hooks.message("Verifying patch " + patch.name);
            patch.entries.forEach(entry => {
                var address = entry.address;
                for(var i = 0; i < entry.values.length; i++) {
                    if(context.rom[address + i] !== entry.values[i]) {
                        throw new Error("Patch " + patch.name  + " conflicts with modified data at address 0x" + (address + i).toString(16));
                    }
                }
                context.rom.set(entry.values, entry.address);
            })
        })
    },

    sortGoodOrder: function(objects) {
        let newObjects = objects.sort((a, b) => a.displayName.localeCompare(b.displayName));
        let changed = true;
        while(changed) {
            changed = false;
            newObjects.forEach(o => {
                if(o.afterOrder) {
                    o.afterOrder.forEach(o2 => {
                        const index = newObjects.indexOf(o);
                        const index2 = newObjects.indexOf(o2);
                        if(index2 > index) {
                            changed = true;
                            newObjects.splice(index, 1);
                            newObjects.splice(index2, 0, o);
                        }
                    })
                }
            })
        } 
        return newObjects;
    }
}

export default utils;