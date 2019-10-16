import {expect} from 'chai';
import {processFilters} from '../src/index';

describe('processFilters', () => {
    it('processes', () => {
        expect(processFilters({})).to.eql({});
    });
});
