import os
import sys
import psycopg2
from psycopg2.extras import DictCursor


def get_connection_uri() -> str:
    """Resolve a connection URI similar to src/config/database.js.

    Prefer DATABASE_PUBLIC_URL, then DATABASE_URL. Falls back to the same
    hardcoded defaults usadas no backend para evitar falhas locais.
    """
    default_public = 'postgresql://postgres:OuKBYrRjizNBPFLJAYJjfumzhjgPHGjm@ballast.proxy.rlwy.net:27968/railway'
    default_internal = 'postgresql://postgres:OuKBYrRjizNBPFLJAYJjfumzhjgPHGjm@postgres.railway.internal:5432/railway'

    uri = os.getenv('DATABASE_PUBLIC_URL') or os.getenv('DATABASE_URL') or default_public or default_internal
    if not uri:
        raise RuntimeError('DATABASE_PUBLIC_URL ou DATABASE_URL não configurados.')
    return uri.strip()


def ensure_imagem_column(conn):
    """Garante que a coluna imagem exista na tabela vagas."""
    with conn.cursor(cursor_factory=DictCursor) as cur:
        print('🔎 Verificando colunas da tabela vagas...')
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'vagas'
            """
        )
        cols = [row['column_name'] for row in cur.fetchall()]
        print('Colunas atuais em vagas:', ', '.join(cols) or '(nenhuma)')

        if 'imagem' not in cols:
            print('📝 Adicionando coluna imagem em vagas...')
            cur.execute("ALTER TABLE vagas ADD COLUMN imagem TEXT NULL;")
            print('✅ Coluna imagem adicionada.')
        else:
            print('ℹ️ Coluna imagem já existe, nenhuma alteração estrutural necessária.')

        conn.commit()
        return cols


def copy_foto_to_imagem_if_needed(conn, existing_columns):
    """Se existir coluna foto, copia seus valores para imagem onde ainda está nulo."""
    if 'foto' not in existing_columns:
        print('ℹ️ Coluna foto não existe em vagas, nada para migrar.')
        return

    with conn.cursor() as cur:
        print('🔄 Migrando dados de foto -> imagem (apenas onde imagem está NULL)...')
        cur.execute("SELECT COUNT(*) FROM vagas WHERE imagem IS NULL AND foto IS NOT NULL;")
        to_update = cur.fetchone()[0]
        print(f'Vagas a serem atualizadas: {to_update}')

        if to_update > 0:
            cur.execute("UPDATE vagas SET imagem = foto WHERE imagem IS NULL AND foto IS NOT NULL;")
            conn.commit()
            print('✅ Migração de dados concluída.')
        else:
            print('ℹ️ Nenhuma vaga precisava de migração de foto para imagem.')


def main():
    try:
        uri = get_connection_uri()
        print('🔗 Conectando ao banco de dados...')
        conn = psycopg2.connect(uri)
        print('✅ Conexão estabelecida.')

        cols = ensure_imagem_column(conn)
        copy_foto_to_imagem_if_needed(conn, cols)

        print('\n✅ Migração da coluna de foto/imagem em vagas concluída com sucesso!')
    except Exception as e:
        print('❌ Erro na migração:', e, file=sys.stderr)
        raise
    finally:
        try:
            if 'conn' in locals() and conn is not None:
                conn.close()
                print('🔌 Conexão fechada.')
        except Exception:
            pass


if __name__ == '__main__':
    main()
