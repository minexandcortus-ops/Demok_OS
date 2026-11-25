import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CategoriesController } from './categories.controller';
import { AdminKeyGuard } from '../admin/admin-key.guard';

const guardsOf = (method: keyof CategoriesController) =>
    Reflect.getMetadata(GUARDS_METADATA, CategoriesController.prototype[method]) ?? [];

describe('CategoriesController guards', () => {
    it('keeps the category list public', () => {
        expect(guardsOf('getAllCategories')).toEqual([]);
    });

    it('protects full recategorization with the admin key', () => {
        expect(guardsOf('recategorizeAllLaws')).toContain(AdminKeyGuard);
    });

    it('protects single-law recategorization with the admin key', () => {
        expect(guardsOf('recategorizeLaw')).toContain(AdminKeyGuard);
    });
});
