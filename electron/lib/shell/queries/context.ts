import {
  makeCouncilTranscriptRepositoryFromSqlExecutor,
  makeQueryLayerRepositoryFromSqlExecutor,
  makeReusablePersonaRepositoryFromSqlExecutor,
  makeSessionParticipationRepositoryFromSqlExecutor,
  makeSessionStateRepositoryFromSqlExecutor,
  makeSessionTagCatalogRepositoryFromSqlExecutor,
} from '../../../../lib/infrastructure/db';
import { makeElectronSqlQueryExecutor } from '../../sql-query-executor.js';
import {
  createCouncilTranscriptRunner,
  createQueryLayerRunner,
  createReusablePersonaRunner,
  createSessionParticipationRunner,
  createSessionStateRunner,
  createSessionTagCatalogRunner,
} from '../../query-runners/index.js';

const sqlQueryExecutor = makeElectronSqlQueryExecutor();

const queryLayerRepository = makeQueryLayerRepositoryFromSqlExecutor(sqlQueryExecutor);
const councilTranscriptRepository = makeCouncilTranscriptRepositoryFromSqlExecutor(sqlQueryExecutor);
const sessionParticipationRepository = makeSessionParticipationRepositoryFromSqlExecutor(sqlQueryExecutor);
const reusablePersonaRepository = makeReusablePersonaRepositoryFromSqlExecutor(sqlQueryExecutor);
const sessionStateRepository = makeSessionStateRepositoryFromSqlExecutor(sqlQueryExecutor);
const sessionTagCatalogRepository = makeSessionTagCatalogRepositoryFromSqlExecutor(sqlQueryExecutor);

export const runQueryLayerRead = createQueryLayerRunner(queryLayerRepository);
export const runCouncilTranscriptRead = createCouncilTranscriptRunner(councilTranscriptRepository);
export const runSessionParticipationRead = createSessionParticipationRunner(sessionParticipationRepository);
export const runReusablePersona = createReusablePersonaRunner(reusablePersonaRepository);
export const runSessionState = createSessionStateRunner(sessionStateRepository);
export const runSessionTagCatalog = createSessionTagCatalogRunner(sessionTagCatalogRepository);
