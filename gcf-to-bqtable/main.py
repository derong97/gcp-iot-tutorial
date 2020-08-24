import base64
import random

from google.cloud import bigquery


def hello_pubsub(event, context):
    data = base64.b64decode(event['data']).decode('utf-8')

    # For example: data = "De Rong, 36.1, 62"
    lst = data.split(',')

    name = str(lst[0]) # De Rong
    temp = float(lst[1]) # 36.1
    heart_rate = int(lst[2]) # 62

    client = bigquery.Client()
    table_id = "gcp-iot-tut.device.data" # [Project].[Dataset].[Table]
    table = client.get_table(table_id)  # Make an API request.

    rows_to_insert = [(name, temp, heart_rate)]

    errors = client.insert_rows(table, rows_to_insert)  # Make an API request.
    if errors == []:
        print("New rows have been added.")
