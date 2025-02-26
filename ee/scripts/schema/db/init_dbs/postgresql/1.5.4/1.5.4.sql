\set ON_ERROR_STOP true
DO
$$
    DECLARE
        previous_version CONSTANT text := 'v1.5.3-ee';
        next_version     CONSTANT text := 'v1.5.4-ee';
    BEGIN
        IF (SELECT openreplay_version()) = previous_version THEN
            raise notice 'valid previous DB version';
        ELSEIF (SELECT openreplay_version()) = next_version THEN
            raise notice 'new version detected, nothing to do';
        ELSE
            RAISE EXCEPTION 'upgrade to % failed, invalid previous version, expected %, got %', next_version,previous_version,(SELECT openreplay_version());
        END IF;
    END ;
$$
LANGUAGE plpgsql;

SET client_min_messages TO NOTICE;
BEGIN;
CREATE OR REPLACE FUNCTION openreplay_version()
    RETURNS text AS
$$
SELECT 'v1.5.4-ee'
$$ LANGUAGE sql IMMUTABLE;


-- to detect duplicate users and delete them if possible
DO
$$
    DECLARE
        duplicate RECORD;
    BEGIN
        IF EXISTS(SELECT user_id
                  FROM users
                  WHERE lower(email) =
                        (SELECT LOWER(email)
                         FROM users AS su
                         WHERE LOWER(su.email) = LOWER(users.email)
                           AND su.user_id != users.user_id
                         LIMIT 1)
                  ORDER BY LOWER(email)) THEN
            raise notice 'duplicate users detected';
            FOR duplicate IN SELECT user_id, email, deleted_at, jwt_iat
                             FROM users
                             WHERE lower(email) =
                                   (SELECT LOWER(email)
                                    FROM users AS su
                                    WHERE LOWER(su.email) = LOWER(users.email)
                                      AND su.user_id != users.user_id
                                    LIMIT 1)
                             ORDER BY LOWER(email)
                LOOP
                    IF duplicate.deleted_at IS NOT NULL OR duplicate.jwt_iat IS NULL THEN
                        raise notice 'deleting duplicate user: %  %',duplicate.user_id,duplicate.email;
                        DELETE FROM users WHERE user_id = duplicate.user_id;
                    END IF;
                END LOOP;
            IF EXISTS(SELECT user_id
                      FROM users
                      WHERE lower(email) =
                            (SELECT LOWER(email)
                             FROM users AS su
                             WHERE LOWER(su.email) = LOWER(users.email)
                               AND su.user_id != users.user_id
                             LIMIT 1)
                      ORDER BY LOWER(email)) THEN
                raise notice 'remaining duplicates, please fix (delete) before finishing update';
                FOR duplicate IN SELECT user_id, email
                                 FROM users
                                 WHERE lower(email) =
                                       (SELECT LOWER(email)
                                        FROM users AS su
                                        WHERE LOWER(su.email) = LOWER(users.email)
                                          AND su.user_id != users.user_id
                                        LIMIT 1)
                                 ORDER BY LOWER(email)
                    LOOP
                        raise notice 'user: %  %',duplicate.user_id,duplicate.email;
                    END LOOP;
                RAISE 'Duplicate users' USING ERRCODE = '42710';
            END IF;
        END IF;
    END;
$$
LANGUAGE plpgsql;

UPDATE users
SET email=LOWER(email);

DROP INDEX IF EXISTS autocomplete_value_gin_idx;
COMMIT;

CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_clickonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'CLICK';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_customonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'CUSTOM';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_graphqlonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'GRAPHQL';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_inputonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'INPUT';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_locationonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'LOCATION';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_referreronly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'REFERRER';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_requestonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'REQUEST';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_revidonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'REVID';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_stateactiononly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'STATEACTION';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_useranonymousidonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'USERANONYMOUSID';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_userbrowseronly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'USERBROWSER';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_usercountryonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'USERCOUNTRY';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_userdeviceonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'USERDEVICE';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_useridonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'USERID';
CREATE INDEX CONCURRENTLY IF NOT EXISTS autocomplete_value_userosonly_gin_idx ON public.autocomplete USING GIN (value gin_trgm_ops) WHERE type = 'USEROS';
