import { Inject } from '@nestjs/common';

export function getRepositoryToken(
  entity: { name?: string } | string,
  dataSource = 'default',
): string {
  if (typeof entity === 'string') {
    return `${dataSource === 'default' ? '' : dataSource + '_'}${entity}Repository`;
  }
  return `${dataSource === 'default' ? '' : dataSource + '_'}${entity?.name ?? 'Entity'}Repository`;
}

export function InjectRepository(
  entity: { name?: string } | string,
  dataSource = 'default',
) {
  return Inject(getRepositoryToken(entity, dataSource));
}

export class TypeOrmModule {
  static forRoot = jest.fn().mockReturnValue({ module: TypeOrmModule });
  static forRootAsync = jest.fn().mockReturnValue({ module: TypeOrmModule });
  static forFeature = jest.fn().mockReturnValue({ module: TypeOrmModule });
}
