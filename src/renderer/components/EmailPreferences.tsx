      toast.success('Email preferences updated successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to update email preferences');
      console.error(error);
    }
  };