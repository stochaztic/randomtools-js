class ReadWriteObject {
    constructor(config) {
        if(config.pointer && this.constructor.every.find(i => i.pointer == config.pointer)) {
            this.constructor.context.hooks.message("WARNING: " + this.constructor.displayName + " already exists at pointer 0x" + config.pointer.toString(16));
        }
        this.index = this.constructor.every.length;
        this.context = this.constructor.context;
        this.pointer = config.pointer;
        this.randomDegree = this.constructor.randomDegree || this.context.specs.randomDegree;
        this.data = {};
        this.oldData = {};
        this.constructor._every.push(this);
    }

    toString() {
        return `${this.constructor.displayName} ${this.index} ${this.name || this.data.name}`;
    }

    static initialize(context) {
        this.context = context;
        this.initialized = true;
    }

    static get every() {
        if(!this.initialized) {
            throw new Error("Not initialized.");
        }
        if(this._every) {
            return this._every.slice();
        }
        this._every = [];
        return this.every;
    }

    get rank() {
        return this.index;
    }

    get intershuffleValid() {
        return true;
    }

    get catalogueIndex() {
        throw new Error("Unimplemented.");
    }

    static get ranked() {
        return this.every.sort((a, b) => {
            return a.rank - b.rank;
        })
    }

    getSimilar(candidates=[], overrideOutsider=false, randomDegree=null) {
        if(this.rank < 0) {
            return this;
        }
        if(candidates.length == 0) {
            candidates = this.constructor.ranked.filter(c => c.rank >= 0);
        }
        candidates = new Set(candidates);
        randomDegree = randomDegree || this.randomDegree;
        
        if(candidates.size == 0) {
            throw new Error("No candidates for getSimilar.");
        }
        if(overrideOutsider && !candidates.has(this)) {
            candidates.add(this);
        }
        else if(!candidates.has(this)) {
            throw new Error("Must manually override outsider elements.");
        }
        else {
            overrideOutsider = false;
        }

        candidates = [...candidates].sort((a, b) => a.rank - b.rank)
        if(candidates.length == 1) {
            return candidates[0];
        }
        let indexOf = candidates.indexOf(this);
        if(overrideOutsider) {
            candidates.splice(indexOf, 1);
            indexOf = this.context.random.choice([indexOf, indexOf - 1]);
            indexOf = Math.min(Math.max(indexOf, 0), candidates.length - 1);
        }
        indexOf = this.context.random.mutateNormal(indexOf, 0, candidates.length-1, randomDegree);
        const chosen = candidates[indexOf];
        if(overrideOutsider) {
            assert(chosen != this);
        }
        return chosen;
    }

    static getSimilarSet(current, candidates=[]) {
        throw new Error("Unimplemented.");
        /*
        def get_similar_set(cls, current, candidates=None):
        if candidates is None:
        candidates = [c for c in cls.ranked if c.rank >= 0]
        candidates = sorted(set(candidates),
                        key=lambda c: (c.rank, random.random(), c.index))
        random.shuffle(sorted(current, key=lambda c: c.index))
        chosens = []
        for c in current:
        while True:
            chosen = c.get_similar(candidates, override_outsider=True)
            assert chosen not in chosens
            chosens.append(chosen)
            candidates.remove(chosen)
            assert chosen not in candidates
            break
        assert len(chosens) == len(current)
        return chosens
        */
    }

    static get(index) {
        if(!isNaN(index)) {
            return this.every[index];
        }
        const objs = this.every.filter(o => o.name && o.name.contains(index));
        if(objs.length > 1) {
            throw new Error("Too many matching objects.");
        }
        if(objs.length < 1) {
            throw new Error("No matching objects.");
        }
        return objs[0];
    }

    static groups() {
        const returndict = {};
        this.every.forEach(obj => {
            if(!returndict[obj.groupIndex]) {
                returndict[obj.groupindex] = [];
            }
            returndict[obj.groupindex].push(obj);
        });
        return returndict;
    }

    static getGroup(index) {
        return this.every.filter(o => o.groupIndex == index);
    }

    get group() {
        return this.constructor.getGroup(this.groupIndex);
    }

    static has(index) {
        try {
            return !!(this.get(index));
        }
        catch(error) {
            return false;
        }
    }

    getBit(bitname) {
        let value;
        Object.keys(this.constructor.bitnames).forEach(attribute => {
            if(value !== undefined) return;
            if(this.constructor.bitnames[attribute].includes(bitname)) {
                const index = this.constructor.bitnames[attribute].indexOf(bitname);
                const byte = this.data[attribute];
                value = byte & (1 << index);
            }
        });
        if(value !== undefined) return value;
        throw new Error("No bit registered under that name.");
    }

    setBit(bitname, bitvalue) {
        bitvalue = bitvalue ? true : false;
        let found = false;
        Object.keys(this.constructor.bitnames).forEach(attribute => {
            if(found) return;
            if(this.constructor.bitnames[attribute].includes(bitname)) {
                const index = this.constructor.bitnames[attribute].indexOf(bitname);
                const byte = this.data[attribute];
                if(bitvalue) {
                    this.data[attribute] = byte | (1 << index);
                }
                else {
                    this.data[attribute] = byte & (0xFF ^ (1 << index));
                }
                found = true;
            }
        });
        if(found) return;
        throw new Error("No bit registered under that name.");
    }

    get displayName() {
        if(this.name === undefined) {
            this.name = this.index.toString(16);
        }
        if(!isNaN(this.name)) {
            return this.name.toString(16);
        }
        return this.name.replace(/[^\x20-\x7E]+/g, '');
    }

    static get displayName() {
        return this._displayName || this.name;
    }

    get VerificationSignature() {
        return this.verificationSignature(false);
    }

    get oldVerificationSignature() {
        return this.verificationSignature(true);
    }

    getVerificationSignature(oldData) {
        throw new Error("Unimplemented.");
        /*
        def get_verification_signature(self, old_data=False):
        labels = sorted([a for (a, b, c) in self.specsattrs
                        if c not in ["str"]])
        if old_data:
        data = str([(label, self.old_data[label]) for label in labels])
        else:
        data = str([(label, getattr(self, label)) for label in labels])

        datahash = md5(data).hexdigest()
        signature = "{0}:{1:0>4}:{2}".format(
        self.__class__.__name__, ("%x" % self.index), datahash)
        return signature
        */
    }

    get description() {
        const className = this.constructor.displayName;
        const index = ("00" + this.index.toString(16)).slice(-2);
        const pointer = this.pointer ? this.pointer.toString(16) : 'None';
        return `${className} ${index} ${pointer} ${this.displayName}`;
    }

    get longDescription() {
        throw new Error("Unimplemented.");
        /*
        @property
        def long_description(self):
        s = []
        for attr in sorted(dir(self)):
        if attr.startswith('_'):
            continue

        if attr in ["specs", "catalogue"]:
            continue

        if hasattr(self.__class__, attr):
            class_attr = getattr(self.__class__, attr)
            if (isinstance(class_attr, property)
                    or hasattr(class_attr, "__call__")):
                continue

        try:
            value = getattr(self, attr)
        except AttributeError:
            continue

        if isinstance(value, dict):
            continue

        if isinstance(value, list):
            if value and not isinstance(value[0], int):
                continue
            value = " ".join(["%x" % v for v in value])

        if isinstance(value, int):
            value = "%x" % value

        s.append((attr, "%s" % value))

        s = ", ".join(["%s: %s" % (a, b) for (a, b) in s])
        s = "%x - %s" % (self.index, s)
        return s
        */
    }

    static get catalogue() {
        throw new Error("Unimplemented.");
        /*
                @classproperty
        def catalogue(self):
        logs = []
        for obj in sorted(self.every, key=lambda o: o.catalogue_index):
        logs.append(obj.log.strip())

        if any(["\n" in log for log in logs]):
        return "\n\n".join(logs)
        else:
        return "\n".join(logs)
        */
    }

    static shouldRandomize(context) {
        return false;
    }

    static fullRandomize() {
        (this.afterOrder || []).forEach(cls2 => {
            if(!cls2.randomizeStepFinished) {
                throw new Error(`Randomize order violated: ${this.displayName} ${cls2.displayName}`)
            }
        })
        this.classReseed("group");
        this.groupshuffle();
        this.classReseed("inter");
        this.intershuffle();
        this.classReseed("full");
        this.shuffleAll();
        this.randomizeAll();
        this.mutateAll();
        this.randomized = true;
    }
    
    static mutateAll() {
        this.every.forEach(o => {
            if(o.mutated) {
                return;
            }
            o.reseed("mut");
            o.mutate();
            o.mutateBits();
            o.mutated = true;
        });
    }

    static randomizeAll() {
        this.every.forEach(o => {
            if(o.randomized) {
                return;
            }
            o.reseed("ran");
            o.randomize();
            o.randomized = true;
        });
    }

    static shuffleAll() {
        this.every.forEach(o => {
            if(o.shuffled) {
                return;
            }
            o.reseed("shu");
            o.shuffle();
            o.shuffled = true;
        });
    }

    mutate() {
        const mutateAttributes = this.mutateAttributes || this.constructor.mutateAttributes;
        if(!mutateAttributes) {
            return;
        }

        Object.keys(mutateAttributes).sort().forEach(attribute => {
            let info = mutateAttributes[attribute];
            if(info && info.prototype instanceof ReadWriteObject) {
                const cls = info;
                const index = this.data[attribute];
                const obj = cls.get(index);
                this.data[attribute] = obj.getSimilar().index;
            }
            else {
                let minmax = info;
                if(!minmax || !minmax.length || !minmax.length == 2) {
                    const values = this.constructor.every.map(o => o.data[attribute]);
                    minmax = [Math.min(...values), Math.max(...values)];
                }
                const value = this.data[attribute];
                if(value < minmax[0] || value > minmax[1]) {
                    return;
                }
                this.data[attribute] = this.context.random.mutateNormal(value, minmax[0], minmax[1], this.randomDegree);
            }
        });
    }

    mutateBits() {
        const mutateBitAttributes = this.mutateBitAttributes || this.constructor.mutateBitAttributes;
        if(!mutateBitAttributes) {
            return;
        }

        mutateBitAttributes.sort().forEach(attribute => {
            const chance = mutateBitAttributes[attribute];
            if(this.context.random.random() <= chance) {
                this.setBit(attribute, !this.getBit(attribute));
            }
        });
    }

    randomize() {
        const randomizeAttributes = this.randomizeAttributes || this.constructor.randomizeAttributes;
        if(!randomizeAttributes) {
            return;
        }
        this.reseed("ran");

        randomizeAttributes.sort().forEach(attribute => {
            const candidates = this.constructor.every.filter(o => o.rank >= 0);
            const chosen = this.context.random.choice(candidates);
            this.data[attribute] = chosen.oldData[attribute];
        });
    }

    shuffle() {
        const shuffleAttributes = this.shuffleAttributes || this.constructor.shuffleAttributes;
        if(!shuffleAttributes) {
            return;
        }
        this.reseed("shu");

        shuffleAttributes.sort().forEach(attributes => {
            if(attributes.length == 1) {
                const attribute = attributes[0];
                const value = this.data[attribute].sort();
                this.data[attribute] = this.context.random.shuffle(value);
                return;
            }
            const values = attributes.map(attribute => this.data[attribute]);
            this.context.random.shuffle(values);
            values.forEach((value, i) => {
                this.data[attributes[i]] = value;
            })
        });
    }

    static intershuffle(candidates=null, randomDegree=null) {
        const intershuffleAttributes = this.intershuffleAttributes || this.constructor.intershuffleAttributes;
        if(!intershuffleAttributes) {
            return;
        }
        randomDegree = randomDegree || this.randomDegree;
        this.classReseed("inter");

        let hardShuffle = false;
        if((new Set(this.every.map(o => o.rank))).size == 1 || this.every.every(o => o.rank == o.index)) {
            hardShuffle = true;
        }
        candidates = (candidates || this.every).filter(c => c.rank >= 0 && c.intershuffleValid);

        intershuffleAttributes.sort().forEach(attributes => {
            let currentCandidates = candidates.slice();
            let shuffled;
            if(hardShuffle) {
                shuffled = this.context.random.shuffle(currentCandidates.slice());
            }
            else {
                currentCandidates.sort((a, b) => a.rank - b.rank);
                shuffled = this.context.random.shuffleNormal(currentCandidates.slice(), randomDegree);
            }

            const attributesArray = Array.isArray(attributes) ? attributes : [attributes];
            attributesArray.forEach(attribute => {
                const newValues = shuffled.map(o => o.data[attribute]);
                currentCandidates.forEach((o, i) => {
                    o.data[attribute] = newValues[i];
                });
            })
        });
    }

    static groupshuffle() {
        if(!this.groupshuffleEnabled) {
            return;
        }
        throw new Error("Unimplemented.");
        /*
        cls.class_reseed("group")
        shuffled = range(cls.numgroups)
        random.shuffle(shuffled)
        swapdict = {}
        for a, b in zip(range(cls.numgroups), shuffled):
            a = cls.getgroup(a)
            b = cls.getgroup(b)
            for a1, b1 in zip(a, b):
                swapdict[a1] = (b1.groupindex, b1.index, b1.pointer)

        for o in cls.every:
            groupindex, index, pointer = swapdict[o]
            o.groupindex = groupindex
            o.index = index
            o.pointer = pointer
        */
    }

    static fullCleanup() {
        (this.afterOrder || []).forEach(cls2 => {
            if(!cls2.cleaned) {
                throw new Error(`Clean order violated: ${this.displayName} ${cls2.displayName}`)
            }
        })
        this.every.forEach(o => {
            o.cleanup();
        });
        this.cleaned = true;
    }

    cleanup() {
        return;
    }

    static writeAll() {
        this.every.forEach(o => o.writeData());
    }

    readData() {
        throw new Error("Unimplemented");
        // Intentionally unimplemented for base ReadWriteObject class.
    }

    copyData(another) {
        this.data = Object.assign({}, another.data);
    }

    writeData() {
        throw new Error("Unimplemented");
        // Intentionally unimplemented for base ReadWriteObject class.
    }

    reseed(salt="") {
        const s = this.context.specs.seed.toString(10) + this.index + salt + this.constructor.displayName;
        this.context.random.seedString(s);
    }

    static classReseed(salt="") {
        const s = this.context.specs.seed.toString(10) + "cls" + salt + this.constructor.displayName;
        this.context.random.seedString(s);
    }
    
    static getByPointer(pointer) {
        const objs = this.every.filter(o => o.pointer === pointer);
        if(objs.length < 1) {
            return null;
        }
        console.assert(objs.length === 1);
        return objs[0];
    }
}


export default ReadWriteObject;