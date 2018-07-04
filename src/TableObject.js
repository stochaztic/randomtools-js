import ReadWriteObject from './ReadWriteObject.js';
import utils from './utils.js';

class TableObject extends ReadWriteObject {
    
    constructor(config) {
        super(config);
        this.groupIndex = config.groupIndex;
        this.variableSize = config.variableSize;
        
        this.readData();
    }

    static get totalSize() {
        return this.tableSpecs.totalSize;
    }

    static initialize(context) {
        super.initialize(context);
        if(this.tableSpecs.text && !this.tableSpecs.attributes) {
            this.parseTableSpecs();
        }
        this.getTableObjects();

        // After initialization, every array should no longer change.
        Object.freeze(this.every);
    }

    static parseTableSpecs() {
        if(!Array.isArray(this.tableSpecs.text)) {
            this.tableSpecs.text = this.tableSpecs.text; 
        }
        this.tableSpecs.totalSize = 0;
        this.tableSpecs.attributes = [];
        this.tableSpecs.text.forEach(entry => {
            entry = entry.trim();
            if(!entry || entry[0] == '#') {
                return;
            }
            let [name, size, other] = entry.split(',');
            if(size.startsWith("bit")) {
                const bitnames = size.split(':')[1].split(" ");
                size = "1";
                if(bitnames.length != 8 || (new Set(bitnames)).size != 8) {
                    throw new Error("Invalid bitnames for " + this.displayName);
                }
                if(!this.bitnames) {
                    this.bitnames = {};
                }
                this.bitnames[name] = bitnames;
            }
            else if (size == "?") {
                size = 0;
            }
            if(size.includes("x")) {
                const [a, b] = size.split("x").map(s => parseInt(s));
                this.tableSpecs.totalSize += (a * b);
            }
            else {
                size = parseInt(size);
                this.tableSpecs.totalSize += size;
            }
            this.tableSpecs.attributes.push({name: name, size: size, other: other});
        });
    }

    static getTableObjects() {
        if(this._every) {
            throw new Error(this.displayName + " already intialized.");
        }
        const cls = this;
        const addObjects = function(n, pointer, groupIndex=0) {
            let p = pointer !== undefined ? pointer : cls.tableSpecs.pointer;
            let accumulatedSize = 0;
            [...Array(n).keys()].forEach(i => {
                const obj = new cls({index: cls.every.length, groupIndex: groupIndex, pointer: p});
                p += cls.totalSize;
                accumulatedSize += cls.totalSize;
            })
            return accumulatedSize;
        }
        const addVariableObject = function(p1, p2) {
            const size = p2 - p1;
            const obj = new cls({index: cls.every.length, groupIndex: 0, pointer: p1, variableSize: size});
            return size;
        }

        if(this.tableSpecs.pointers) {
            if(!Array.isArray(this.tableSpecs.pointers)) {
                this.tableSpecs.pointers = this.tableSpecs.pointers; 
            }
            this.tableSpecs.pointers.forEach(entry => {
                entry = entry.trim();
                if(!entry || entry[0] == '#') {
                    return;
                }
                const pointer = parseInt(entry.split()[0], 0x10);
                addObjects(1, pointer);
            })
        }
        else if(!this.tableSpecs.grouped && !this.tableSpecs.pointed && !this.tableSpecs.delimit) {
            addObjects(this.tableSpecs.count);
        }
        else if(this.tableSpecs.grouped) {
            throw new Error("Unimplemented.");
            /*
            counter = 0
            while len(objects) < number:
                if objtype.specs.groupednum is None:
                    f = get_open_file(filename)
                    f.seek(pointer)
                    value = ord(f.read(1))
                    pointer += 1
                else:
                    value = objtype.specs.groupednum
                pointer += add_objects(value, groupindex=counter)
                counter += 1
            */
        }
        else if(this.tableSpecs.pointed && this.tableSpecs.delimit) {
            throw new Error("Unimplemented.");
            /*
            size = objtype.specspointedsize
            counter = 0
            f = get_open_file(filename)
            while counter < number:
                f.seek(pointer)
                subpointer = read_multi(f, size) + objtype.specspointedpointer
                while True:
                    f.seek(subpointer)
                    peek = ord(f.read(1))
                    if peek == objtype.specsdelimitval:
                        break
                    obj = objtype(filename, subpointer, index=len(objects),
                                groupindex=counter, size=None)
                    objects.append(obj)
                    subpointer += objtype.total_size
                pointer += size
                counter += 1
            */
        }
        else if(this.tableSpecs.pointed && this.totalSize > 0) {
            throw new Error("Unimplemented.");
            /*
            size = objtype.specspointedsize
            counter = 0
            f = get_open_file(filename)
            while counter < number:
                f.seek(pointer)
                subpointer = read_multi(f, size) + objtype.specspointedpointer
                f.seek(pointer + size)
                subpointer2 = read_multi(f, size) + objtype.specspointedpointer
                groupcount = (subpointer2 - subpointer) / objtype.total_size
                if objtype.specspointedpoint1:
                    groupcount = 1
                add_objects(groupcount, groupindex=counter, p=subpointer)
                pointer += size
                counter += 1
            */
        }
        else if(this.tableSpecs.pointed && this.totalSize === 0) {
            throw new Error("Unimplemented.");
            /*
            size = objtype.specspointedsize
            counter = 0
            f = get_open_file(filename)
            while counter < number:
                f.seek(pointer + (size*counter))
                subpointer = read_multi(f, size) + objtype.specspointedpointer
                f.seek(pointer + (size*counter) + size)
                subpointer2 = read_multi(f, size) + objtype.specspointedpointer
                add_variable_object(subpointer, subpointer2)
                counter += 1
            */
        }
        else if(this.tableSpecs.delimit) {
            throw new Error("Unimplemented.");
            /*
            f = get_open_file(filename)
            for counter in xrange(number):
                while True:
                    f.seek(pointer)
                    peek = ord(f.read(1))
                    if peek == objtype.specsdelimitval:
                        pointer += 1
                        break
                    obj = objtype(filename, pointer, index=len(objects),
                                groupindex=counter, size=None)
                    objects.append(obj)
                    pointer += obj.total_size
            */
        }
    }
    
    readData(pointer) {
        pointer = pointer || this.pointer;
        const specsattrs = this.variableSize ? this.getVariableSpecsattrs() : this.constructor.tableSpecs.attributes;

        specsattrs.forEach(specattr => {
            let value;
            if(!specattr.other || specattr.other == "int") {
                value = utils.readMulti(this.context.rom, pointer, specattr.size);
                pointer += specattr.size;
            }
            else if(specattr.other == "str") {
                value = String.fromCodePoint(...rom.slice(pointer, pointer + specattr.size));
                pointer += specattr.size;
            }
            else if(specattr.other == "list") {
                let number = specattr.size;
                let numbytes = 1;
                if(number.includes && number.includes("x")) {
                    [number, numbytes] = specattr.size.split("x").map(s => parseInt(s));
                }
                value = [];
                [...Array(number).keys()].forEach(i => {
                    value.push(utils.readMulti(this.context.rom, pointer, numbytes));
                    pointer += numbytes;
                });
            }
            this.oldData[specattr.name] = value;
            this.data[specattr.name] = Array.isArray(value) ? value.slice() : value;
        })
    }

    static writeAll() {
        if(this.tableSpecs.pointedpoint1 || !(this.tableSpecs.grouped || this.tableSpecs.pointed || this.tableSpecs.delimit)) {
            this.every.forEach(o => {
                o.writeData();
            })
            return;
        }
        if(this.tableSpecs.grouped) {
            throw new Error("Unimplemented.");
            /*
            elif cls.specsgrouped:
                pointer = cls.specspointer
                f = get_open_file(filename)
                for i in range(cls.numgroups):
                    objs = [o for o in cls.every if o.groupindex == i]
                    f.seek(pointer)
                    if cls.specs.groupednum is None:
                        f.write(chr(len(objs)))
                        pointer += 1
                    for o in objs:
                        pointer = o.write_data(filename, pointer)
            */
            return;
        }
        if(this.tableSpecs.pointed && this.tableSpecs.delimit) {
            throw new Error("Unimplemented.");
            /*
             elif cls.specspointed and cls.specsdelimit:
                 pointer = cls.specspointedpointer
                 f = get_open_file(filename)
                 for i in range(cls.specscount):
                     objs = [o for o in cls.every if o.groupindex == i]
                     if not objs:
                         continue
                     f.seek(cls.specspointer + (cls.specspointedsize * i))
                     write_multi(f, pointer-cls.specspointedpointer,
                                 length=cls.specspointedsize)
                     f.seek(pointer)
                     for o in objs:
                         pointer = o.write_data(filename, pointer)
                     f.seek(pointer)
                     f.write(chr(cls.specsdelimitval))
                     pointer += 1
                 if pointer == cls.specspointedpointer:
                     raise Exception("No objects in pointdelimit data.")
                 nullpointer = pointer-1
                 for i in range(cls.specscount):
                     objs = [o for o in cls.every if o.groupindex == i]
                     if objs:
                         continue
                     f.seek(cls.specspointer + (cls.specspointedsize * i))
                     write_multi(f, nullpointer-cls.specspointedpointer,
                                 length=cls.specspointedsize)
             */
            return;
        }
        if(this.tableSpecs.pointed) {
            throw new Error("Unimplemented.");
            /*
            elif cls.specspointed:
                pointer = cls.specspointer
                size = cls.specspointedsize
                f = get_open_file(filename)
                first_pointer = min([o.pointer for o in cls.every if o is not None])
                pointedpointer = max(first_pointer, pointer + (cls.specscount * size))
                mask = (2 ** (8*size)) - 1
                for i in range(cls.specscount):
                    #masked = pointedpointer & mask
                    masked = (pointedpointer-cls.specspointedpointer) & mask
                    objs = [o for o in cls.every if o.groupindex == i]
                    if hasattr(cls, "groupsort"):
                        objs = cls.groupsort(objs)
                    for o in objs:
                        pointedpointer = o.write_data(filename, pointedpointer)
                    f.seek(pointer + (i*size))
                    write_multi(f, masked, length=size)
            */
            return;
        }
        if(this.tableSpecs.delimit) {
            throw new Error("Unimplemented.");
            /*
            elif cls.specsdelimit:
                f = get_open_file(filename)
                pointer = cls.specspointer
                for i in range(cls.specscount):
                    objs = cls.getgroup(i)
                    if hasattr(cls, "groupsort"):
                        objs = cls.groupsort(objs)
                    for o in objs:
                        pointer = o.write_data(filename, pointer)
                    f.seek(pointer)
                    f.write(chr(cls.specsdelimitval))
                    pointer += 1
            */
            return;
        }
    }

    writeData(pointer, syncing=false) {
        pointer = pointer || this.pointer;
        const specs = this.constructor.tableSpecs;
        let specsattrs = specs.attributes;
        if(pointer === undefined) {
            return;
        }
        if(!syncing && specs.syncpointers) {
            specs.syncpointers.forEach( p => {
                const offset = p - specs.pointer;
                const newPointer = this.pointer + offset;
                this.writeData(newPointer, true);
            })
            return;
        }
        if(this.variableSize) {
            specsattrs = this.getVariableSpecsattrs();
        }

        specsattrs.forEach(specattr => {
            const value = this.data[specattr.name];
            if(!specattr.other || specattr.other == "int") {
                utils.writeMulti(this.context.rom, pointer, value, specattr.size);
                pointer += specattr.size;
            }
            else if(specattr.other == "str") {
                if(value.length != specattr.size) {
                    throw new Error(specattr.name + " str specattr size mismatch on write.");
                }
                const newValue = Array.from(value).map(c => c.codePointAt(0));
                this.context.rom.set(newValue, pointer);
                pointer += specattr.size;
            }
            else if(specattr.other == "list") {
                let number = specattr.size;
                let numbytes = 1;
                if(number.includes && number.includes("x")) {
                    [number, numbytes] = specattr.size.split("x").map(s => parseInt(s));
                }
                if(value.length != number) {
                    throw new Error(specattr.name + " list specattr size mismatch on write.");
                }
                value.forEach(v => {
                    utils.writeMulti(this.context.rom, pointer, v, numbytes);
                    pointer += numbytes;
                })
            }
        })
        return pointer;
    }

    
    getVariableSpecsattrs(self) {
        throw new Error("Unimplemented");
        /* 
        specsattrs = [(name, self.variable_size, other)
                      for (name, size, other)
                      in self.specsattrs if size == 0]
        if not specsattrs:
            raise ValueError("No valid specs attributes.")
        elif len(specsattrs) >= 2:
            raise ValueError("Too many specs attributes.")
        return specsattrs*/
    }
}

TableObject.tableSpecs = {
    text: "byte,1",
    count: 0,
    pointer: 0x0,
    pointers: undefined,
    group: undefined,
    pointed: undefined,
    delimit: undefined,
    syncpointers: undefined,
};

export default TableObject;