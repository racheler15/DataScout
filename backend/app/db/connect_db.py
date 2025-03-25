import psycopg2
from psycopg2.extras import RealDictCursor
import os

from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    try:
        connection = psycopg2.connect(
            dbname=os.getenv('EVAL_DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            host=os.getenv('DB_HOST'),
            port=os.getenv('DB_PORT'),
            cursor_factory=RealDictCursor
        )
        return connection
    except Exception as error:
        print(f"Error connecting to the database: {error}")
        raise error


class DatabaseConnection:
    def __enter__(self):
        self.conn = get_db_connection()
        self.cursor = self.conn.cursor()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is not None:
            self.conn.rollback()
        else:
            self.conn.commit()
        self.cursor.close()
        self.conn.close()

    def reset_connection(self):
        """Reset the connection and cursor."""
        try:
            # Close current connection and cursor
            if self.cursor:
                self.cursor.close()
            if self.conn:
                self.conn.close()

            # Re-establish connection and cursor
            self.conn = get_db_connection()
            self.cursor = self.conn.cursor()

            print("Database connection and cursor have been reset.")
        except Exception as error:
            print(f"Error resetting connection: {error}")
            raise error