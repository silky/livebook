
import pandas as pd


class Test:
    def test_getitem(self):
        print "testing getitem..."
        df1 = pd.DataFrame.from_data({"head":["name","age"],"body":{"name":["zak","aaron"],"age":[30,40]},"length":2})
        df2 = df1.set_index("name")
        assert df1[0] == ("zak",30)
        assert df2[0] == ("aaron",40)

    def test_reindex(self):
        print "testing reindex..."
        df = pd.DataFrame.from_data({"head":["h1","h2"],"body":{"h1":[1,2,4,8],"h2":[25,25,25,30]},"length":4})
        df2 = df._reindex([3,2,1,0])
        df3 = df._reindex([0,4,1,2],sort="h2")
        assert df.h1[0] == 1
        assert df.h1[3] == 8
        assert df2._sort == None
        assert df2.h1[0] == 8
        assert df2.h1[3] == 1
        assert df3._sort == "h2"
        assert df3.h1[0] == 1
        assert df3.h1[3] == 4

    def test_select(self):
        print "testing select..."
        df = pd.DataFrame.from_data({"head":["h1","h2","h3"],"body":{"h1":[1,2,1,1],"h2":[25,25,25,30],"h3":["cow","cow","pig","cow"]},"length":4})
        df2 = df.select("h1",1)
        assert len(df2) == 3
        df3 = df2.select("h2",25)
        assert len(df3) == 2
        df4 = df3.select("h3","cow")
        assert len(df4) == 1
        assert len(df4.h1) == 1
        assert df4.h1[0] == 1
        assert df4.h2[0] == 25
        assert df4.h3[0] == "cow"

    def test_resample(self):
        print "testing resample..."
        df = pd.DataFrame.from_data({"head":["h1","h2","h3"],"body":{"h1":[1,2,1,1],"h2":[10,30,25,25],"h3":["monkey","cow","dog","pig"]},"length":4})
        s1 = df.set_index("h1")["h2"]
        s2 = df.set_index("h2")["h1"]
        r1 = s1.resample("Q")
        assert r1[0] == 20
        assert r1[1] == 30
        r2 = s2.resample("Q",how="count")
        assert r2[0] == 1
        assert r2[1] == 2
        print "testing monthly resample..."
        df = pd.DataFrame.from_data({"head":["date","bolides"],"body":{"date":['2015-01-01','2015-01-02','2015-02-01'],"bolides":[2,6,150]},"length":3})
        bb = df.set_index("date")["bolides"]
        s1 = bb.resample("M",how="count")
        s2 = bb.resample("M")
        s3 = bb.resample("A",how="count")
        assert s1._to_list() == [2,1]
        assert s2._to_list() == [4,150]
        assert s3._to_list() == [3]

    def test_set_index(self):
        print "testing index..."
        df = pd.DataFrame.from_data({"head":["h1","h2"],"body":{"h1":[1,2,3,4],"h2":[40,30,20,10]},"length":4})
        df2 = df.set_index("h1")
        df3 = df.set_index("h2")
        assert df2.h1[0] == 1
        assert df3.h1[0] == 4
        assert df3.h2[0] == 10

    def test_dropna(self):
        print "testing dropna..."
        df = pd.DataFrame.from_data({"head":["h1","h2"],"body":{"h1":[1,2,None,None],"h2":[10,None,30,40]},"length":4})
        df2 = df.dropna(subset=["h1"])
        df3 = df.dropna(subset=["h2"])
        df4 = df.dropna(subset=["h2","h1"])
        assert len(df2) == 2
        assert len(df3) == 3
        assert len(df4) == 1

    def test_dataframe(self):
        print "testing dataframe..."
        df = pd.DataFrame.from_data({"head":["h1","h2"],"body":{"h1":[1,2,3,4],"h2":[10,20,30,40]},"length":4})
        assert type(df[0]) == tuple
        assert type(df["h1"]) == pd.Series
        assert len(df) == 4
        assert df[0] == (1,10)
        assert df.h1[0] == 1
        assert df.h2[2] == 30
        assert df["h1"][1] == 2
        assert df["h2"][1] == 20

def do_test(t,name):
    try:
        getattr(t,name)()
    except Exception as e:
        print e
        print "-- ERROR -- There was an error running test '%s'"%name

def run():
    t = Test()
    print "begin testing"
    do_test(t,"test_dataframe")
    do_test(t,"test_dropna")
    do_test(t,"test_set_index")
    do_test(t,"test_resample")
    do_test(t,"test_select")
    do_test(t,"test_reindex")
    do_test(t,"test_getitem")
    print "done"
