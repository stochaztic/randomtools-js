import seedrandom from 'seedrandom';

const Random = {
    
    seed: function(val) {
        this._seed = val;
        this._rng = seedrandom.alea(val);
    },

    seedString: function(str) {
        //this.seed(this.hashString(str));
        this._seed = str;
        this._rng = seedrandom.alea(str);
    },

    getSeed: function() {
        return this._seed;
    },

    random: function() {
        return this._rng();
    },

    randint: function(min, max) { // inclusive on both ends
        return Math.floor(this.random() * (max + 1 - min)) + min;
    },

    choice: function(arr) {
        return arr[Math.floor(this.random() * arr.length)];
    },

    sample: function(arr, k) {
        if(k > arr.length) {
            throw new Error("Sample size larger than population size.");
        }
        const newArr = this.shuffle(arr.slice());
        return newArr.slice(0, k);
    },

    shuffle: function(arr) { // In-place
        let j, x, i;
        for (i = arr.length - 1; i > 0; i--) {
            j = Math.floor(this.random() * (i + 1));
            x = arr[i];
            arr[i] = arr[j];
            arr[j] = x;
        }
        return arr;
    },
    
    shuffleNormal(candidates, degree, wide=false) { // Not In-place
        if(candidates.length <= 1) return candidates;
        if(degree === undefined) {
            degree = candidates[0].context.specs.randomDegree;
        }
        const maxIndex = candidates.length - 1;
        const newIndexes = [];
        candidates.forEach((candidate, i) => {
            const newIndex = this.mutateNormal(i, 0, maxIndex, degree, true, wide);
            newIndexes.push({newIndex: newIndex, o: candidate});
        });
        return newIndexes.sort((a, b) => a.newIndex - b.newIndex).map(ni => ni.o);
    },

    uniform: function(a, b) {
        return this.random() * (b - a);
    },

    mutateNormal: function(base, minimum, maximum, degree, returnFloat = false, wide = false) {
        if(!(minimum <= base && base <= maximum)) {
            throw new Error("Invalid min/base/max for mutateNormal.");
        }
        if(minimum == maximum) {
            return base;
        }
        const baseval = base-minimum;
        const width = maximum-minimum;
        const factor = this.genRandomNormal(degree);
        const maxwidth = Math.max(baseval, width-baseval);
        const minwidth = Math.min(baseval, width-baseval);
        let subwidth, subfactor, modifier, value;
        if(wide) {
            subwidth = maxwidth;
        }
        else {
            let widthFactor = 1.0;
            [...Array(7).keys()].forEach(i => {
                widthFactor *= this.uniform(degree, widthFactor);
            });
            subwidth = (minwidth * (1-widthFactor)) + (maxwidth * widthFactor);
        }
        if(factor > 0.5) {
            subfactor = (factor-0.5) * 2;
            modifier = subwidth * subfactor;
            value = baseval + modifier;
        }
        else {
            subfactor = 1- (factor * 2);
            modifier = subwidth * subfactor;
            value = baseval - modifier;
        }
        value += minimum;
        if(!returnFloat) {
            value = Math.round(value);
        }
        if(value < minimum || value > maximum) {
            return this.mutateNormal(base, minimum, maximum, degree, returnFloat, wide);
        }
        return value;
    },
    
    genRandomNormal: function(degree) {
        const value_a = (this.random() + this.random() + this.random()) / 3.0;
        const value_b = this.random();
        const value_c = 0.5;
        if (degree > 0.5) {
            const factor = (degree * 2) - 1;
            return (value_a * (1-factor)) + (value_b * factor);
        }
        const factor = degree * 2;
        return (value_c * (1-factor)) + (value_a * factor);
    },
    
    hashString: function(str) {
        var hash = 0, i, chr;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            chr   = str.charCodeAt(i);
            hash  = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        return hash;
    }
}

export default Random;